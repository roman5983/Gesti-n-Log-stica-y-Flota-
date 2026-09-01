import { prisma } from '../../database/prisma-client';
import type { DocumentType, DriverDocument, Prisma } from '../../generated/prisma/client';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { DbClient } from '../audit-logs/audit-logs.repository';

/** Soft-delete convention (RN-20): every read filters deletedAt = null. */
export const documentsRepository = {
  findByDriver(driverId: number): Promise<DriverDocument[]> {
    return prisma.driverDocument.findMany({
      where: { driverId, deletedAt: null },
      orderBy: { id: 'asc' },
    });
  },

  /**
   * True if the driver has any active document already expired (RN-4).
   * A document expiring today is still valid today (same DATE semantics as
   * licenses, RN-1).
   */
  async hasExpiredActive(driverId: number, db: DbClient = prisma): Promise<boolean> {
    const expired = await db.driverDocument.findFirst({
      where: { driverId, deletedAt: null, expiryDate: { lt: utcStartOfToday() } },
      select: { id: true },
    });
    return expired !== null;
  },

  /**
   * True if the driver already has an ACTIVE (non-deleted) document of this
   * type. Enforced in the service, not by a DB UNIQUE: soft-delete keeps the
   * row, and MySQL has no partial unique index filtered on deleted_at,
   * so a re-upload after deletion would collide with the tombstoned row.
   */
  async activeTypeExists(
    driverId: number,
    documentType: DocumentType,
    excludeId?: number,
  ): Promise<boolean> {
    const existing = await prisma.driverDocument.findFirst({
      where: {
        driverId,
        documentType,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return existing !== null;
  },

  findById(id: number, db: DbClient = prisma): Promise<DriverDocument | null> {
    return db.driverDocument.findFirst({ where: { id, deletedAt: null } });
  },

  create(data: Prisma.DriverDocumentUncheckedCreateInput, db: DbClient = prisma) {
    return db.driverDocument.create({ data });
  },

  update(id: number, data: Prisma.DriverDocumentUpdateInput, db: DbClient = prisma) {
    return db.driverDocument.update({ where: { id }, data });
  },

  softDelete(id: number, db: DbClient = prisma) {
    return db.driverDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
