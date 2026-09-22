import type { Response } from 'express';

/**
 * Uploaded files (driver documents, maintenance receipts) live in the
 * database, next to their metadata — not on disk. Hosting platforms such as
 * Render's free tier wipe the local filesystem on every deploy or restart,
 * and files are small (<= 1 MB, F-9), so a MEDIUMBLOB column is enough.
 * Storing them in the same row also makes an upload atomic: bytes, metadata
 * and audit entry are written in one transaction, with nothing to roll back
 * on disk if the database write fails.
 */
export interface StoredFile {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}

/**
 * Bytes of an upload as Prisma's `Bytes` column expects them. Multer's Buffer
 * may be a view over Node's shared memory pool (ArrayBufferLike); Prisma
 * wants a Uint8Array over a plain ArrayBuffer — copying (<= 1 MB) settles it.
 */
export function toBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(buffer);
}

/**
 * Send a stored file inline (viewable in the browser; the original name is
 * offered when saving). Shared by the document and attachment downloads.
 */
export function sendStoredFile(res: Response, file: StoredFile): void {
  res.type(file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
  res.send(Buffer.from(file.content.buffer, file.content.byteOffset, file.content.byteLength));
}
