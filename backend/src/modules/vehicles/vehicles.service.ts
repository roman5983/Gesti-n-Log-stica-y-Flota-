import { prisma } from '../../database/prisma-client';
import type { Vehicle, VehicleStatus } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { maintenancesRepository } from '../maintenances/maintenances.repository';
import { vehiclesRepository, type VehicleFilters } from './vehicles.repository';
import type { CreateVehicleDto, ListVehiclesQuery, UpdateVehicleDto } from './vehicles.schemas';

export interface VehicleResponse {
  id: number;
  licensePlate: string;
  model: string;
  year: number;
  initialKm: number;
  accumulatedKm: number;
  lastMaintenanceDate: Date | null;
  insuranceExpiryDate: Date | null;
  /** Insurance valid today (or no expiry recorded yet → false, surfaced as alertable). */
  insuranceValid: boolean;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}

function toResponse(vehicle: Vehicle): VehicleResponse {
  return {
    id: vehicle.id,
    licensePlate: vehicle.licensePlate,
    model: vehicle.model,
    year: vehicle.year,
    initialKm: vehicle.initialKm,
    accumulatedKm: vehicle.accumulatedKm,
    lastMaintenanceDate: vehicle.lastMaintenanceDate,
    insuranceExpiryDate: vehicle.insuranceExpiryDate,
    insuranceValid:
      vehicle.insuranceExpiryDate !== null && vehicle.insuranceExpiryDate >= utcStartOfToday(),
    status: vehicle.status,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

function toAuditSnapshot(vehicle: Vehicle) {
  return {
    licensePlate: vehicle.licensePlate,
    model: vehicle.model,
    year: vehicle.year,
    initialKm: vehicle.initialKm,
    accumulatedKm: vehicle.accumulatedKm,
    insuranceExpiryDate: vehicle.insuranceExpiryDate,
    status: vehicle.status,
  };
}

async function getExistingOrFail(id: number): Promise<Vehicle> {
  const vehicle = await vehiclesRepository.findById(id);
  if (!vehicle) throw new NotFoundError(`Vehicle ${id} not found`);
  return vehicle;
}

export const vehiclesService = {
  async list(query: ListVehiclesQuery): Promise<PaginatedResult<VehicleResponse>> {
    const filters: VehicleFilters = { status: query.status, search: query.search };
    const [vehicles, total] = await Promise.all([
      vehiclesRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      vehiclesRepository.count(filters),
    ]);
    return { items: vehicles.map(toResponse), total };
  },

  async getById(id: number): Promise<VehicleResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  async create(dto: CreateVehicleDto, actorId: number): Promise<VehicleResponse> {
    if (await vehiclesRepository.plateTaken(dto.licensePlate)) {
      throw new ConflictError(`License plate ${dto.licensePlate} is already registered`);
    }

    const created = await prisma.$transaction(async (tx) => {
      const vehicle = await vehiclesRepository.create(
        {
          licensePlate: dto.licensePlate,
          model: dto.model,
          year: dto.year,
          initialKm: dto.initialKm,
          // The odometer starts at the manually entered value (A-13).
          accumulatedKm: dto.initialKm,
          insuranceExpiryDate: dto.insuranceExpiryDate,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'VEHICLE',
          entityId: vehicle.id,
          newData: toAuditSnapshot(vehicle),
        },
        tx,
      );
      return vehicle;
    });
    return toResponse(created);
  },

  async update(id: number, dto: UpdateVehicleDto, actorId: number): Promise<VehicleResponse> {
    const existing = await getExistingOrFail(id);

    if (dto.licensePlate && dto.licensePlate !== existing.licensePlate) {
      if (await vehiclesRepository.plateTaken(dto.licensePlate, id)) {
        throw new ConflictError(`License plate ${dto.licensePlate} is already registered`);
      }
    }
    // initialKm anchors the whole km history (RN-5 snapshots, RN-11 updates):
    // once the vehicle has trips or maintenances, changing it would corrupt
    // every derived figure. Editable only while there is no history.
    let accumulatedKm: number | undefined;
    if (dto.initialKm !== undefined && dto.initialKm !== existing.initialKm) {
      if (await vehiclesRepository.hasHistory(id)) {
        throw new BusinessRuleError(
          'Initial km cannot be changed once the vehicle has trips or maintenances',
        );
      }
      accumulatedKm = dto.initialKm; // no history → odometer follows the correction
    }

    const updated = await prisma.$transaction(async (tx) => {
      const vehicle = await vehiclesRepository.update(
        id,
        {
          licensePlate: dto.licensePlate,
          model: dto.model,
          year: dto.year,
          initialKm: dto.initialKm,
          accumulatedKm,
          insuranceExpiryDate: dto.insuranceExpiryDate,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'VEHICLE',
          entityId: id,
          previousData: toAuditSnapshot(existing),
          newData: toAuditSnapshot(vehicle),
        },
        tx,
      );
      return vehicle;
    });
    return toResponse(updated);
  },

  /**
   * RN-16 / A-8: only an ADMIN moves a vehicle to INACTIVE, manually
   * (enforced by route authorization + this explicit transition).
   */
  async deactivate(id: number, actorId: number): Promise<VehicleResponse> {
    const existing = await getExistingOrFail(id);
    if (existing.status === 'INACTIVE') return toResponse(existing); // idempotent
    if (existing.status === 'ON_TRIP') {
      throw new BusinessRuleError('A vehicle on an active trip cannot be deactivated');
    }
    // A vehicle in the workshop has an open maintenance whose completion would
    // move it back to AVAILABLE, silently overwriting an INACTIVE set here.
    if (existing.status === 'IN_WORKSHOP') {
      throw new BusinessRuleError('A vehicle undergoing maintenance cannot be deactivated');
    }
    return toResponse(await this.transition(existing, 'INACTIVE', 'DEACTIVATE', actorId));
  },

  /** INACTIVE → AVAILABLE. Maintenance rules may re-block it later (RN-3). */
  async activate(id: number, actorId: number): Promise<VehicleResponse> {
    const existing = await getExistingOrFail(id);
    if (existing.status !== 'INACTIVE') {
      throw new BusinessRuleError(`Only INACTIVE vehicles can be activated (current: ${existing.status})`);
    }
    return toResponse(await this.transition(existing, 'AVAILABLE', 'ACTIVATE', actorId));
  },

  async transition(
    existing: Vehicle,
    status: VehicleStatus,
    action: 'ACTIVATE' | 'DEACTIVATE',
    actorId: number,
  ): Promise<Vehicle> {
    return prisma.$transaction(async (tx) => {
      const vehicle = await vehiclesRepository.update(existing.id, { status }, tx);
      await auditLogsService.record(
        {
          actorId,
          action,
          entity: 'VEHICLE',
          entityId: existing.id,
          previousData: { status: existing.status },
          newData: { status },
        },
        tx,
      );
      return vehicle;
    });
  },

  async softDelete(id: number, actorId: number): Promise<void> {
    const existing = await getExistingOrFail(id);
    if (existing.status === 'ON_TRIP') {
      throw new BusinessRuleError('A vehicle on an active trip cannot be deleted');
    }
    // An open maintenance (PENDING/IN_PROGRESS) would end up pointing at a
    // deleted vehicle. Covers IN_WORKSHOP and any scheduled-but-not-started
    // maintenance — broader and more precise than checking the status alone.
    if (await maintenancesRepository.hasOpenForVehicle(id)) {
      throw new BusinessRuleError('A vehicle with an open maintenance cannot be deleted');
    }

    await prisma.$transaction(async (tx) => {
      await vehiclesRepository.softDelete(id, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'DELETE',
          entity: 'VEHICLE',
          entityId: id,
          previousData: toAuditSnapshot(existing),
        },
        tx,
      );
    });
  },
};
