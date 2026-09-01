import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/constants';
import { BadRequestError } from '../shared/errors/app-error';

/**
 * File upload middleware factory (F-9).
 *
 * memoryStorage (not diskStorage) is deliberate: with a 1 MB cap the file
 * fits comfortably in memory, and nothing is ever written to disk until the
 * size/MIME checks pass. diskStorage would stream to disk while receiving
 * and leave a partial file behind when the size limit aborts the upload.
 * The service writes the validated buffer to disk (Stage 1: files on
 * filesystem, metadata in DB).
 */
export function createUploader() {
  function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(new BadRequestError('Only PDF, JPG and PNG files are allowed'));
      return;
    }
    cb(null, true);
  }

  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
  });
}
