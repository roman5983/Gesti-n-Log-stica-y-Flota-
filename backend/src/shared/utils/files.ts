import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { UPLOAD_ROOT } from '../../config/constants';

export interface StoredFile {
  /** Relative path on disk, persisted as metadata. */
  filePath: string;
}

/**
 * Persist an in-memory upload to disk under uploads/<subfolder>/ with a
 * random, collision-free name (the original name is kept as DB metadata).
 * Only called after size/MIME validation has passed.
 */
export async function storeFile(
  subfolder: string,
  originalName: string,
  buffer: Buffer,
): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(dir, `${randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return { filePath };
}

/**
 * Best-effort deletion of a stored file. Used to roll back when the
 * accompanying DB write fails (files live outside the DB transaction).
 * Never throws: a missing file is a no-op.
 */
export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Already gone or never written — nothing to undo.
  }
}
