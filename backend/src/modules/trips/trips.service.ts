import { prisma } from '../../database/prisma-client';
import type { TripStatus } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { FIXED_TRIP_ORIGIN } from '../../config/constants';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { AuthenticatedUser } from '../../shared/types/auth';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { driversRepository } from '../drivers/drivers.repository';
import { documentsRepository } from '../documents/documents.repository';
import { vehiclesRepository } from '../vehicles/vehicles.repository';
import { tripsRepository, type TripFilters, type TripWithRelations } from './trips.repository';
import type {
  AssignTripDto,
  CreateTripDto,
  FinishTripDto,
  ListTripsQuery,
  UpdateTripDto,
} from './trips.schemas';

export interface TripResponse {
  id: number;
  origin: string;
  destination: string;
  departureAt: Date;
  status: TripStatus;
  estimatedDistanceKm: number | null;
  estimatedTimeMin: number | null;
  notes: string | null;
  operator: { id: number; name: string };
  driver: { id: number; name: string; dni: string } | null;
  vehicle: { id: number; licensePlate: string; model: string } | null;
  departureKm: number | null;
  arrivalKm: number | null;
  assignedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

function toResponse(t: TripWithRelations): TripResponse {
  return {
    id: t.id,
    origin: t.origin,
    destination: t.destination,
    departureAt: t.departureAt,
    status: t.status,
    estimatedDistanceKm: t.estimatedDistanceKm ? Number(t.estimatedDistanceKm) : null,
    estimatedTimeMin: t.estimatedTimeMin,
    notes: t.notes,
    operator: t.operator,
    driver: t.driver ? { id: t.driver.userId, name: t.driver.user.name, dni: t.driver.dni } : null,
    vehicle: t.vehicle,
    departureKm: t.departureKm,
    arrivalKm: t.arrivalKm,
    assignedAt: t.assignedAt,
    finishedAt: t.finishedAt,
    createdAt: t.createdAt,
  };
}

function auditSnapshot(t: TripWithRelations) {
  return {
    destination: t.destination,
    departureAt: t.departureAt,
    status: t.status,
    driverId: t.driverId,
    vehicleId: t.vehicleId,
  };
}

async function getExistingOrFail(id: number): Promise<TripWithRelations> {
  const trip = await tripsRepository.findById(id);
  if (!trip) throw new NotFoundError(`Trip ${id} not found`);
  return trip;
}

export const tripsService = {
  async list(query: ListTripsQuery, actor: AuthenticatedUser): Promise<PaginatedResult<TripResponse>> {
    const filters: TripFilters = {
      status: query.status,
      driverId: query.driverId,
      vehicleId: query.vehicleId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
    // A driver only ever sees their own trips (current trip + history,
    // P-CH-2/P-CH-5), regardless of any driverId passed in the query.
    if (actor.role === 'DRIVER') filters.driverId = actor.id;

    const [trips, total] = await Promise.all([
      tripsRepository.findMany(filters, { skip: (query.page - 1) * query.limit, take: query.limit }),
      tripsRepository.count(filters),
    ]);
    return { items: trips.map(toResponse), total };
  },

  async getById(id: number, actor: AuthenticatedUser): Promise<TripResponse> {
    const trip = await getExistingOrFail(id);
    if (actor.role === 'DRIVER' && trip.driverId !== actor.id) {
      throw new ForbiddenError('You can only view your own trips');
    }
    return toResponse(trip);
  },

  /** Create a trip: generates the route only (A-1). Origin is fixed (RN-21). */
  async create(dto: CreateTripDto, actorId: number): Promise<TripResponse> {
    const created = await prisma.$transaction(async (tx) => {
      const trip = await tripsRepository.create(
        {
          origin: FIXED_TRIP_ORIGIN,
          destination: dto.destination,
          departureAt: dto.departureAt,
          notes: dto.notes,
          estimatedDistanceKm: dto.estimatedDistanceKm,
          estimatedTimeMin: dto.estimatedTimeMin,
          operatorId: actorId,
        },
        tx,
      );
      await auditLogsService.record(
        { actorId, action: 'CREATE', entity: 'TRIP', entityId: trip.id, newData: auditSnapshot(trip) },
        tx,
      );
      return trip;
    });
    return toResponse(created);
  },

  async update(id: number, dto: UpdateTripDto, actorId: number): Promise<TripResponse> {
    const existing = await getExistingOrFail(id);
    // A-4/RN-22: once assigned, a trip cannot be edited.
    if (existing.status !== 'PENDING_ASSIGNMENT') {
      throw new BusinessRuleError('Only trips pending assignment can be edited');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const trip = await tripsRepository.update(
        id,
        {
          destination: dto.destination,
          departureAt: dto.departureAt,
          notes: dto.notes,
          estimatedDistanceKm: dto.estimatedDistanceKm,
          estimatedTimeMin: dto.estimatedTimeMin,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'TRIP',
          entityId: id,
          previousData: auditSnapshot(existing),
          newData: auditSnapshot(trip),
        },
        tx,
      );
      return trip;
    });
    return toResponse(updated);
  },

  /**
   * Assign a trip (A-1): the operator picks the driver; the system picks the
   * vehicle automatically (RN-12). The trip starts effectively — it moves to
   * IN_PROGRESS and the vehicle to ON_TRIP. All validations and both state
   * changes happen in one transaction, with row locks to serialize
   * concurrent assignments (no DB constraint backs "one active trip/vehicle").
   */
  async assign(id: number, dto: AssignTripDto, actorId: number): Promise<TripResponse> {
    const existing = await getExistingOrFail(id);
    if (existing.status !== 'PENDING_ASSIGNMENT') {
      throw new BusinessRuleError('This trip is not pending assignment');
    }

    // Driver eligibility (read outside the tx; re-verified under lock below).
    const driver = await driversRepository.findById(dto.driverId);
    if (!driver) throw new NotFoundError(`Driver ${dto.driverId} not found`);

    const assigned = await prisma.$transaction(async (tx) => {
      // Lock the driver, then re-check availability under the lock (RN-19/RN-6:
      // no other active trip). RN-6 reduces to RN-19 here because assignment
      // starts the trip immediately, so a driver can hold only one at a time.
      await tripsRepository.lockDriver(dto.driverId, tx);

      // Re-read the driver UNDER the lock: the pre-lock read could be stale
      // if the driver was deactivated in the meantime. isActive/license are
      // checked on this fresh copy.
      const lockedDriver = await driversRepository.findById(dto.driverId, tx);
      if (!lockedDriver) throw new NotFoundError(`Driver ${dto.driverId} not found`);
      if (!lockedDriver.user.isActive) {
        throw new BusinessRuleError('Driver is not active');
      }
      // RN-1: license valid through its expiry date.
      if (lockedDriver.licenseExpiryDate < utcStartOfToday()) {
        throw new BusinessRuleError('Driver license is expired', 'RN-1');
      }
      // RN-4: no EXPIRED active documentation blocks assignment.
      // Deliberate simplification (business decision for this case): the
      // ABSENCE of documents does NOT block — a driver with no documents
      // loaded is still assignable. This avoids day-to-day operational
      // blocks; it is intentional, not an oversight.
      if (await documentsRepository.hasExpiredActive(dto.driverId, tx)) {
        throw new BusinessRuleError('Driver has expired documentation', 'RN-4');
      }
      // RN-19/RN-6: driver must not already be on an active trip.
      if (await tripsRepository.hasActiveTrip(dto.driverId, tx)) {
        throw new ConflictError('Driver already has an active trip');
      }

      // RN-12/RN-2/C-1: auto-select and lock an AVAILABLE vehicle.
      const vehicleId = await tripsRepository.pickAvailableVehicle(tx);
      if (vehicleId === null) {
        throw new ConflictError('No available vehicle to assign');
      }
      const vehicle = await vehiclesRepository.findById(vehicleId, tx);
      if (!vehicle) throw new ConflictError('No available vehicle to assign');

      // Effects: trip → IN_PROGRESS with driver/vehicle and a km snapshot;
      // vehicle → ON_TRIP.
      const trip = await tripsRepository.update(
        id,
        {
          status: 'IN_PROGRESS',
          driver: { connect: { userId: dto.driverId } },
          vehicle: { connect: { id: vehicleId } },
          departureKm: vehicle.accumulatedKm,
          assignedAt: new Date(),
        },
        tx,
      );
      await vehiclesRepository.update(vehicleId, { status: 'ON_TRIP' }, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'ASSIGN',
          entity: 'TRIP',
          entityId: id,
          previousData: { status: 'PENDING_ASSIGNMENT' },
          newData: { status: 'IN_PROGRESS', driverId: dto.driverId, vehicleId, vehicleStatus: 'ON_TRIP' },
        },
        tx,
      );
      return trip;
    });
    return toResponse(assigned);
  },

  /**
   * Finish a trip (A-3): the driver (ideally) or an operator closes it, with
   * identical effect. Effects (RN-5/8/11): validate arrival km > departure km,
   * update the vehicle odometer, release the vehicle (→ AVAILABLE), move the
   * trip to COMPLETED, and refresh the driver's denormalized stats.
   */
  async finish(id: number, dto: FinishTripDto, actor: AuthenticatedUser): Promise<TripResponse> {
    // Early ownership check (authorization does not change with concurrency).
    const preview = await getExistingOrFail(id);
    if (actor.role === 'DRIVER' && preview.driverId !== actor.id) {
      throw new ForbiddenError('You can only finish your own trip');
    }

    const now = new Date();
    const finished = await prisma.$transaction(async (tx) => {
      // Lock the trip and RE-READ under the lock: two concurrent finishes
      // (driver and operator at once) serialize here, so the effects
      // (odometer, driver stats) are applied exactly once. The loser sees
      // the trip already COMPLETED and is rejected.
      await tripsRepository.lockTrip(id, tx);
      const existing = await tripsRepository.findById(id, tx);
      if (!existing) throw new NotFoundError(`Trip ${id} not found`);
      if (existing.status !== 'IN_PROGRESS') {
        throw new BusinessRuleError('Only in-progress trips can be finished');
      }
      // RN-5: arrival km strictly greater than departure km.
      if (existing.departureKm === null || dto.arrivalKm <= existing.departureKm) {
        throw new BusinessRuleError(
          `Arrival km must be greater than departure km (${existing.departureKm})`,
          'RN-5',
        );
      }
      const tripKm = dto.arrivalKm - existing.departureKm;

      const trip = await tripsRepository.update(
        id,
        {
          status: 'COMPLETED',
          arrivalKm: dto.arrivalKm,
          finishedAt: now,
          finishedBy: { connect: { id: actor.id } },
        },
        tx,
      );
      // RN-11/RN-8: update odometer and release the vehicle.
      if (existing.vehicleId !== null) {
        await vehiclesRepository.update(
          existing.vehicleId,
          { accumulatedKm: dto.arrivalKm, status: 'AVAILABLE' },
          tx,
        );
      }
      // Refresh the driver's denormalized stats (completed trips, avg km).
      if (existing.driverId !== null) {
        const driver = await driversRepository.findById(existing.driverId, tx);
        if (driver) {
          const newCount = driver.completedTrips + 1;
          const newAvg = (Number(driver.avgKm) * driver.completedTrips + tripKm) / newCount;
          await driversRepository.update(
            existing.driverId,
            { completedTrips: newCount, avgKm: newAvg },
            tx,
          );
        }
      }
      await auditLogsService.record(
        {
          actorId: actor.id,
          action: 'FINISH',
          entity: 'TRIP',
          entityId: id,
          previousData: { status: 'IN_PROGRESS' },
          newData: { status: 'COMPLETED', arrivalKm: dto.arrivalKm, vehicleStatus: 'AVAILABLE' },
        },
        tx,
      );
      return trip;
    });
    return toResponse(finished);
  },

  /**
   * Delete a trip: only while PENDING_ASSIGNMENT (RN-15). Such a trip has no
   * operational history (no vehicle/driver touched), so a hard delete is
   * correct; RN-20 (soft delete) targets entities with history. Trips are
   * never cancellable (RN-14), so IN_PROGRESS/COMPLETED are never deletable.
   */
  async delete(id: number, actorId: number): Promise<void> {
    const existing = await getExistingOrFail(id);
    if (existing.status !== 'PENDING_ASSIGNMENT') {
      throw new BusinessRuleError('Only trips pending assignment can be deleted');
    }
    await prisma.$transaction(async (tx) => {
      await tripsRepository.delete(id, tx);
      await auditLogsService.record(
        { actorId, action: 'DELETE', entity: 'TRIP', entityId: id, previousData: auditSnapshot(existing) },
        tx,
      );
    });
  },
};
