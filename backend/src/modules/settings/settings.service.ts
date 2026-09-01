import { prisma } from '../../database/prisma-client';
import type { CompanySettings } from '../../generated/prisma/client';
import { NotFoundError } from '../../shared/errors/app-error';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { settingsRepository } from './settings.repository';
import type { UpdateSettingsDto } from './settings.schemas';

export interface SettingsResponse {
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  language: string;
  dateFormat: string;
  updatedAt: Date;
}

function toResponse(s: CompanySettings): SettingsResponse {
  return {
    companyName: s.companyName,
    taxId: s.taxId,
    address: s.address,
    phone: s.phone,
    email: s.email,
    timezone: s.timezone,
    language: s.language,
    dateFormat: s.dateFormat,
    updatedAt: s.updatedAt,
  };
}

export const settingsService = {
  async get(): Promise<SettingsResponse> {
    const settings = await settingsRepository.get();
    if (!settings) throw new NotFoundError('Company settings not initialized');
    return toResponse(settings);
  },

  async update(dto: UpdateSettingsDto, actorId: number): Promise<SettingsResponse> {
    const existing = await settingsRepository.get();
    if (!existing) throw new NotFoundError('Company settings not initialized');

    const updated = await prisma.$transaction(async (tx) => {
      const settings = await settingsRepository.update(dto, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'COMPANY_SETTINGS',
          entityId: settings.id,
          previousData: toResponse(existing),
          newData: toResponse(settings),
        },
        tx,
      );
      return settings;
    });
    return toResponse(updated);
  },
};
