import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../shared/errors/app-error';
import { isProduction } from '../config/env';
import { MAX_FILE_SIZE_BYTES } from '../config/constants';

/**
 * Global error handler — the SINGLE point where errors become HTTP responses.
 * Response shape (Stage 1 convention): { error: { code, message, details? } }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // File upload errors (multer). Oversized file (F-9) → 413; others → 400.
  if (err instanceof MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooLarge
          ? `File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / 1024} KB`
          : err.message,
      },
    });
    return;
  }

  // Safety net for DB unique-constraint races (e.g. two concurrent creates
  // with the same email): services validate first, but the constraint can
  // still fire — translate it to 409 instead of leaking a 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with this unique value already exists' },
    });
    return;
  }

  // FK constraint (ON DELETE RESTRICT): deleting a row still referenced by
  // others. Services check first, but a concurrent insert can slip in —
  // translate to 409 instead of a leaked 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'This record is referenced by other records and cannot be deleted',
      },
    });
    return;
  }

  // Unexpected error: log it, never leak internals to the client.
  req.log?.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Internal server error' : String(err),
    },
  });
}

/** 404 for unknown routes, with the same error shape. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
