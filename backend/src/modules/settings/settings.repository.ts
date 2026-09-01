import { prisma } from '../../database/prisma-client';
import type { CompanySettings, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

const SETTINGS_ID = 1;

/** Single-row company settings (id = 1), seeded and only updated. */
export const settingsRepository = {
  get(db: DbClient = prisma): Promise<CompanySettings | null> {
    return db.companySettings.findUnique({ where: { id: SETTINGS_ID } });
  },

  update(data: Prisma.CompanySettingsUpdateInput, db: DbClient = prisma): Promise<CompanySettings> {
    return db.companySettings.update({ where: { id: SETTINGS_ID }, data });
  },
};
