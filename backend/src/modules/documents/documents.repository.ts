import { prisma } from '../../database/prisma-client';
import type { DocumentType, Prisma } from '../../generated/prisma/client';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { DbClient } from '../audit-logs/audit-logs.repository';

/**
 * The file bytes (up to 1 MB each) are never loaded with the metadata:
 * listings, updates and audit snapshots only need the metadata, and Prisma
 * returns the whole row — blob included — from creates and updates too.
 * Only findContent() reads them.
 */
const withoutContent = { content: true } as const;

/** A document row as the app handles it: metadata only. */
export type DocumentRow = Prisma.DriverDocumentGetPayload<{ omit: typeof withoutContent }>;

/** Soft-delete convention (RN-20): every read filters deletedAt = null. */
export const documentsRepository = {
  findByDriver(driverId: number): Promise<DocumentRow[]> {
    return prisma.driverDocument.findMany({
      where: { driverId, deletedAt: null },
      orderBy: { id: 'asc' },
      omit: withoutContent,
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

  findById(id: number, db: DbClient = prisma): Promise<DocumentRow | null> {
    return db.driverDocument.findFirst({ where: { id, deletedAt: null }, omit: withoutContent });
  },

  /** The file itself, for download. Null content = uploaded before files moved into the DB. */
  findContent(id: number) {
    return prisma.driverDocument.findFirst({
      where: { id, deletedAt: null },
      select: { driverId: true, fileName: true, mimeType: true, content: true },
    });
  },

  create(
    data: Prisma.DriverDocumentUncheckedCreateInput,
    db: DbClient = prisma,
  ): Promise<DocumentRow> {
    return db.driverDocument.create({ data, omit: withoutContent });
  },

  update(
    id: number,
    data: Prisma.DriverDocumentUpdateInput,
    db: DbClient = prisma,
  ): Promise<DocumentRow> {
    return db.driverDocument.update({ where: { id }, data, omit: withoutContent });
  },

  softDelete(id: number, db: DbClient = prisma): Promise<DocumentRow> {
    return db.driverDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
      omit: withoutContent,
    });
  },
};
