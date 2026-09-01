import { prisma } from '../../database/prisma-client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { safeUnlink, storeFile } from '../../shared/utils/files';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { vehiclesRepository } from '../vehicles/vehicles.repository';
import {
  maintenancesRepository,
  type MaintenanceFilters,
  type MaintenanceWithRelations,
} from './maintenances.repository';
import type {
  CreateMaintenanceDto,
  ListMaintenancesQuery,
  UpdateMaintenanceDto,
} from './maintenances.schemas';

export interface MaintenanceResponse {
  id: number;
  vehicle: { id: number; licensePlate: string; model: string };
  maintenanceType: { id: number; name: string };
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  scheduledAt: Date;
  completedAt: Date | null;
  km: number;
  notes: string | null;
  nextMaintenanceKm: number | null;
  attachments: {
    id: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: Date;
  }[];
}

function toResponse(m: MaintenanceWithRelations): MaintenanceResponse {
  return {
    id: m.id,
    vehicle: m.vehicle,
    maintenanceType: m.maintenanceType,
    status: m.status,
    scheduledAt: m.scheduledAt,
    completedAt: m.completedAt,
    km: m.km,
    notes: m.notes,
    nextMaintenanceKm: m.nextMaintenanceKm,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
    })),
  };
}

function toAuditSnapshot(m: MaintenanceWithRelations) {
  return {
    vehicleId: m.vehicleId,
    maintenanceTypeId: m.maintenanceTypeId,
    status: m.status,
    scheduledAt: m.scheduledAt,
    km: m.km,
  };
}

async function getExistingOrFail(id: number): Promise<MaintenanceWithRelations> {
  const maintenance = await maintenancesRepository.findById(id);
  if (!maintenance) throw new NotFoundError(`Maintenance ${id} not found`);
  return maintenance;
}

export const maintenancesService = {
  async list(query: ListMaintenancesQuery): Promise<PaginatedResult<MaintenanceResponse>> {
    const filters: MaintenanceFilters = {
      vehicleId: query.vehicleId,
      status: query.status,
      view: query.view,
    };
    const [items, total] = await Promise.all([
      maintenancesRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      maintenancesRepository.count(filters),
    ]);
    return { items: items.map(toResponse), total };
  },

  async getById(id: number): Promise<MaintenanceResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  /** Register (schedule) a maintenance: it is born PENDING (C-6). */
  async create(dto: CreateMaintenanceDto, actorId: number): Promise<MaintenanceResponse> {
    const vehicle = await vehiclesRepository.findById(dto.vehicleId);
    if (!vehicle) throw new NotFoundError(`Vehicle ${dto.vehicleId} not found`);

    const type = await prisma.maintenanceType.findUnique({
      where: { id: dto.maintenanceTypeId },
      select: { id: true },
    });
    if (!type) throw new NotFoundError(`Maintenance type ${dto.maintenanceTypeId} not found`);

    const created = await prisma.$transaction(async (tx) => {
      // Lock the vehicle row, then check for an open maintenance INSIDE the
      // transaction: two concurrent creates for the same vehicle serialize
      // here, so at most one open maintenance can exist (no DB UNIQUE backs
      // this rule, unlike email/plate).
      await maintenancesRepository.lockVehicle(dto.vehicleId, tx);
      if (await maintenancesRepository.hasOpenForVehicle(dto.vehicleId, undefined, tx)) {
        throw new ConflictError('This vehicle already has an open maintenance');
      }
      const maintenance = await maintenancesRepository.create(
        {
          vehicleId: dto.vehicleId,
          maintenanceTypeId: dto.maintenanceTypeId,
          scheduledAt: dto.scheduledAt,
          km: dto.km,
          notes: dto.notes,
          nextMaintenanceKm: dto.nextMaintenanceKm,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'MAINTENANCE',
          entityId: maintenance.id,
          newData: toAuditSnapshot(maintenance),
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(created);
  },

  async update(id: number, dto: UpdateMaintenanceDto, actorId: number): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    // RN-22: a completed maintenance is immutable (it belongs to history).
    if (existing.status === 'COMPLETED') {
      throw new BusinessRuleError('A completed maintenance cannot be edited');
    }
    if (dto.maintenanceTypeId && dto.maintenanceTypeId !== existing.maintenanceTypeId) {
      const type = await prisma.maintenanceType.findUnique({
        where: { id: dto.maintenanceTypeId },
        select: { id: true },
      });
      if (!type) throw new NotFoundError(`Maintenance type ${dto.maintenanceTypeId} not found`);
    }
    // Cross-field invariant against effective values: the schema only sees
    // fields present in this request, so a partial edit (only km, or only
    // nextMaintenanceKm) is re-checked here against the stored record.
    const effectiveKm = dto.km ?? existing.km;
    const effectiveNextKm =
      dto.nextMaintenanceKm !== undefined ? dto.nextMaintenanceKm : existing.nextMaintenanceKm;
    if (effectiveNextKm !== null && effectiveNextKm < effectiveKm) {
      throw new BusinessRuleError('nextMaintenanceKm must be greater than or equal to km');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const maintenance = await maintenancesRepository.update(
        id,
        {
          maintenanceType: dto.maintenanceTypeId
            ? { connect: { id: dto.maintenanceTypeId } }
            : undefined,
          scheduledAt: dto.scheduledAt,
          km: dto.km,
          notes: dto.notes,
          nextMaintenanceKm: dto.nextMaintenanceKm,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: toAuditSnapshot(existing),
          newData: toAuditSnapshot(maintenance),
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * PENDING → IN_PROGRESS. Effect: vehicle AVAILABLE → IN_WORKSHOP (F-6).
   * The vehicle must be AVAILABLE — a unit on a trip or already inactive
   * cannot enter the workshop.
   */
  async start(id: number, actorId: number): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    if (existing.status !== 'PENDING') {
      throw new BusinessRuleError(`Only PENDING maintenances can be started (current: ${existing.status})`);
    }
    const vehicle = await vehiclesRepository.findById(existing.vehicleId);
    if (!vehicle) throw new NotFoundError(`Vehicle ${existing.vehicleId} not found`);
    if (vehicle.status !== 'AVAILABLE') {
      throw new BusinessRuleError(
        `Vehicle must be AVAILABLE to start maintenance (current: ${vehicle.status})`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const maintenance = await maintenancesRepository.update(id, { status: 'IN_PROGRESS' }, tx);
      await vehiclesRepository.update(existing.vehicleId, { status: 'IN_WORKSHOP' }, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: { status: 'PENDING' },
          newData: { status: 'IN_PROGRESS', vehicleStatus: 'IN_WORKSHOP' },
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * IN_PROGRESS → COMPLETED. Effects (RN-9, F-6): vehicle IN_WORKSHOP →
   * AVAILABLE, lastMaintenanceDate updated, maintenance moves to history.
   */
  async complete(id: number, actorId: number): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    if (existing.status !== 'IN_PROGRESS') {
      throw new BusinessRuleError(
        `Only IN_PROGRESS maintenances can be completed (current: ${existing.status})`,
      );
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const maintenance = await maintenancesRepository.update(
        id,
        { status: 'COMPLETED', completedAt: now },
        tx,
      );
      // RN-9: completing the maintenance unblocks the vehicle.
      await vehiclesRepository.update(
        existing.vehicleId,
        { status: 'AVAILABLE', lastMaintenanceDate: now },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'FINISH',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: { status: 'IN_PROGRESS' },
          newData: { status: 'COMPLETED', vehicleStatus: 'AVAILABLE' },
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * Attach a receipt (F-9). The upload is validated in memory (size/MIME);
   * here we persist it to disk and record its metadata. If the DB write
   * fails, the just-written file is removed so no orphan is left behind.
   *
   * Intentionally allowed even when the maintenance is COMPLETED: RN-22
   * protects the maintenance RECORD (km, dates, type, status), not its
   * supporting documentation. A receipt is additive evidence — the invoice
   * usually arrives after the work is closed — not a mutation of history.
   * Attachments are append-only: they can be added but never edited or
   * deleted (no delete/replace endpoint exists). If one is ever added, it
   * must be restricted, to preserve the historical integrity of the record.
   */
  async addAttachment(
    id: number,
    file: Express.Multer.File,
    actorId: number,
  ): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    const stored = await storeFile('maintenances', file.originalname, file.buffer);
    try {
      await prisma.$transaction(async (tx) => {
        await maintenancesRepository.addAttachment(
          {
            maintenanceId: existing.id,
            fileName: file.originalname,
            filePath: stored.filePath,
            mimeType: file.mimetype,
            fileSize: file.size,
          },
          tx,
        );
        await auditLogsService.record(
          {
            actorId,
            action: 'UPDATE',
            entity: 'MAINTENANCE',
            entityId: id,
            newData: { attachmentAdded: file.originalname },
          },
          tx,
        );
      });
    } catch (err) {
      await safeUnlink(stored.filePath); // roll back the just-written file
      throw err;
    }
    return toResponse((await maintenancesRepository.findById(id))!);
  },

  /**
   * Resolve an attachment for download: returns the metadata the controller
   * needs to stream the file (path on disk, original name, MIME type).
   * Scoped to the maintenance so an attachment id from another record
   * cannot be fetched through this maintenance.
   */
  async getAttachment(
    maintenanceId: number,
    attachmentId: number,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const attachment = await maintenancesRepository.findAttachment(attachmentId, maintenanceId);
    if (!attachment) {
      throw new NotFoundError(
        `Attachment ${attachmentId} not found for maintenance ${maintenanceId}`,
      );
    }
    return {
      filePath: attachment.filePath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  },
};
