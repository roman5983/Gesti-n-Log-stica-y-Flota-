import { prisma } from '../../database/prisma-client';
import type { MaintenanceType } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { maintenanceTypesRepository } from './maintenance-types.repository';
import type {
  CreateMaintenanceTypeDto,
  ListMaintenanceTypesQuery,
  UpdateMaintenanceTypeDto,
} from './maintenance-types.schemas';

export interface MaintenanceTypeResponse {
  id: number;
  name: string;
  description: string;
  kmAlert: number;
  kmTarget: number;
  monthsAlert: number | null;
  monthsTarget: number | null;
}

function toResponse(type: MaintenanceType): MaintenanceTypeResponse {
  return {
    id: type.id,
    name: type.name,
    description: type.description,
    kmAlert: type.kmAlert,
    kmTarget: type.kmTarget,
    monthsAlert: type.monthsAlert,
    monthsTarget: type.monthsTarget,
  };
}

async function getExistingOrFail(id: number): Promise<MaintenanceType> {
  const type = await maintenanceTypesRepository.findById(id);
  if (!type) throw new NotFoundError(`Maintenance type ${id} not found`);
  return type;
}

export const maintenanceTypesService = {
  async list(query: ListMaintenanceTypesQuery): Promise<PaginatedResult<MaintenanceTypeResponse>> {
    const [types, total] = await Promise.all([
      maintenanceTypesRepository.findMany({
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      maintenanceTypesRepository.count(),
    ]);
    return { items: types.map(toResponse), total };
  },

  async getById(id: number): Promise<MaintenanceTypeResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  async create(dto: CreateMaintenanceTypeDto, actorId: number): Promise<MaintenanceTypeResponse> {
    if (await maintenanceTypesRepository.nameTaken(dto.name)) {
      throw new ConflictError(`Maintenance type "${dto.name}" already exists`);
    }

    const created = await prisma.$transaction(async (tx) => {
      const type = await maintenanceTypesRepository.create(dto, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'MAINTENANCE_TYPE',
          entityId: type.id,
          newData: toResponse(type),
        },
        tx,
      );
      return type;
    });
    return toResponse(created);
  },

  async update(
    id: number,
    dto: UpdateMaintenanceTypeDto,
    actorId: number,
  ): Promise<MaintenanceTypeResponse> {
    const existing = await getExistingOrFail(id);
    if (dto.name !== existing.name && (await maintenanceTypesRepository.nameTaken(dto.name, id))) {
      throw new ConflictError(`Maintenance type "${dto.name}" already exists`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const type = await maintenanceTypesRepository.update(
        id,
        // monthsAlert/monthsTarget: absent means "remove the time threshold"
        // (full-set update semantics — see schema comment).
        {
          name: dto.name,
          description: dto.description,
          kmAlert: dto.kmAlert,
          kmTarget: dto.kmTarget,
          monthsAlert: dto.monthsAlert ?? null,
          monthsTarget: dto.monthsTarget ?? null,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE_TYPE',
          entityId: id,
          previousData: toResponse(existing),
          newData: toResponse(type),
        },
        tx,
      );
      return type;
    });
    return toResponse(updated);
  },

  /**
   * Hard delete, only when unused: catalog rows without references carry no
   * history (RN-20 targets entities with operational history). A referenced
   * type is blocked here — and by the DB FK RESTRICT as a second layer.
   */
  async delete(id: number, actorId: number): Promise<void> {
    const existing = await getExistingOrFail(id);
    if (await maintenanceTypesRepository.isInUse(id)) {
      throw new BusinessRuleError(
        'This maintenance type is referenced by existing maintenances and cannot be deleted',
      );
    }

    await prisma.$transaction(async (tx) => {
      await maintenanceTypesRepository.delete(id, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'DELETE',
          entity: 'MAINTENANCE_TYPE',
          entityId: id,
          previousData: toResponse(existing),
        },
        tx,
      );
    });
  },
};
