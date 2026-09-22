import { prisma } from '../../database/prisma-client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { AuthenticatedUser } from '../../shared/types/auth';
import { toBytes, type StoredFile } from '../../shared/utils/files';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { driversRepository } from '../drivers/drivers.repository';
import { documentsRepository, type DocumentRow } from './documents.repository';
import type { CreateDocumentDto, UpdateDocumentDto } from './documents.schemas';

export interface DocumentResponse {
  id: number;
  driverId: number;
  documentType: string;
  expiryDate: Date;
  /** Valid today (expiry >= today) — same DATE semantics as licenses (RN-1). */
  expired: boolean;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
}

function toResponse(doc: DocumentRow): DocumentResponse {
  return {
    id: doc.id,
    driverId: doc.driverId,
    documentType: doc.documentType,
    expiryDate: doc.expiryDate,
    expired: doc.expiryDate < utcStartOfToday(),
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    uploadedAt: doc.uploadedAt,
  };
}

function auditSnapshot(doc: DocumentRow) {
  return { driverId: doc.driverId, documentType: doc.documentType, expiryDate: doc.expiryDate };
}

/**
 * Resource-level authorization (F-4 / P-CH-3): an Admin manages any driver's
 * documents; a driver only their own. Operators are not in this flow.
 */
function assertCanAccess(actor: AuthenticatedUser, driverId: number): void {
  if (actor.role === 'ADMIN') return;
  if (actor.role === 'DRIVER' && actor.id === driverId) return;
  throw new ForbiddenError('Solo podés acceder a tus propios documentos');
}

async function getDriverOrFail(driverId: number): Promise<void> {
  const driver = await driversRepository.findById(driverId);
  if (!driver) throw new NotFoundError(`No se encontró el chofer ${driverId}`);
}

/** Fetch a document ensuring it belongs to the given driver. */
async function getOwnedDocumentOrFail(
  driverId: number,
  documentId: number,
): Promise<DocumentRow> {
  const doc = await documentsRepository.findById(documentId);
  if (!doc || doc.driverId !== driverId) {
    throw new NotFoundError(`No se encontró el documento ${documentId} del chofer ${driverId}`);
  }
  return doc;
}

export const documentsService = {
  async list(driverId: number, actor: AuthenticatedUser): Promise<DocumentResponse[]> {
    assertCanAccess(actor, driverId);
    await getDriverOrFail(driverId);
    const docs = await documentsRepository.findByDriver(driverId);
    return docs.map(toResponse);
  },

  /** Upload a document (F-9 validated upstream); file stored after checks. */
  async create(
    driverId: number,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    actor: AuthenticatedUser,
  ): Promise<DocumentResponse> {
    assertCanAccess(actor, driverId);
    await getDriverOrFail(driverId);

    // One active document per type per driver. To replace it, the Admin must
    // delete the current one first — a driver cannot silently stack documents.
    if (await documentsRepository.activeTypeExists(driverId, dto.documentType)) {
      throw new ConflictError(
        `El chofer ${driverId} ya tiene un documento ${dto.documentType} vigente`,
      );
    }

    // The bytes go in the same row, inside the same transaction as the
    // metadata and the audit entry: either all of it is stored or none.
    const created = await prisma.$transaction(async (tx) => {
      const doc = await documentsRepository.create(
        {
          driverId,
          documentType: dto.documentType,
          expiryDate: dto.expiryDate,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          content: toBytes(file.buffer),
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId: actor.id,
          action: 'CREATE',
          entity: 'DRIVER_DOCUMENT',
          entityId: doc.id,
          newData: auditSnapshot(doc),
        },
        tx,
      );
      return doc;
    });
    return toResponse(created);
  },

  /** Update document metadata (type/expiry). To replace the file, upload a new one. */
  async update(
    driverId: number,
    documentId: number,
    dto: UpdateDocumentDto,
    actor: AuthenticatedUser,
  ): Promise<DocumentResponse> {
    assertCanAccess(actor, driverId);
    const existing = await getOwnedDocumentOrFail(driverId, documentId);

    // Changing the type must not create a second active document of that type
    // (same one-active-per-type rule as create). excludeId skips this record.
    if (dto.documentType && dto.documentType !== existing.documentType) {
      if (await documentsRepository.activeTypeExists(driverId, dto.documentType, documentId)) {
        throw new ConflictError(
          `El chofer ${driverId} ya tiene un documento ${dto.documentType} vigente`,
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await documentsRepository.update(
        documentId,
        { documentType: dto.documentType, expiryDate: dto.expiryDate },
        tx,
      );
      await auditLogsService.record(
        {
          actorId: actor.id,
          action: 'UPDATE',
          entity: 'DRIVER_DOCUMENT',
          entityId: documentId,
          previousData: auditSnapshot(existing),
          newData: auditSnapshot(doc),
        },
        tx,
      );
      return doc;
    });
    return toResponse(updated);
  },

  /**
   * Soft-delete the document (RN-20). The file on disk is intentionally kept:
   * the record still references it for audit/history; physical cleanup, if
   * ever needed, is a separate maintenance concern.
   */
  async remove(
    driverId: number,
    documentId: number,
    actor: AuthenticatedUser,
  ): Promise<void> {
    assertCanAccess(actor, driverId);
    const existing = await getOwnedDocumentOrFail(driverId, documentId);

    await prisma.$transaction(async (tx) => {
      await documentsRepository.softDelete(documentId, tx);
      await auditLogsService.record(
        {
          actorId: actor.id,
          action: 'DELETE',
          entity: 'DRIVER_DOCUMENT',
          entityId: documentId,
          previousData: auditSnapshot(existing),
        },
        tx,
      );
    });
  },

  async getForDownload(
    driverId: number,
    documentId: number,
    actor: AuthenticatedUser,
  ): Promise<StoredFile> {
    assertCanAccess(actor, driverId);
    const doc = await documentsRepository.findContent(documentId);
    if (!doc || doc.driverId !== driverId) {
      throw new NotFoundError(`No se encontró el documento ${documentId} del chofer ${driverId}`);
    }
    if (!doc.content) throw new NotFoundError('El archivo ya no está disponible');
    return { fileName: doc.fileName, mimeType: doc.mimeType, content: doc.content };
  },
};
