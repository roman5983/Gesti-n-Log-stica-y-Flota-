import type { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../shared/errors/app-error';
import { sendStoredFile } from '../../shared/utils/files';
import { documentsService } from './documents.service';
import type { CreateDocumentDto, UpdateDocumentDto } from './documents.schemas';

export const documentsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverId } = req.params as unknown as { driverId: number };
      res.json({ data: await documentsService.list(driverId, req.user!) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new BadRequestError('Se requiere un archivo (campo: "file")');
      const { driverId } = req.params as unknown as { driverId: number };
      const doc = await documentsService.create(
        driverId,
        req.body as CreateDocumentDto,
        req.file,
        req.user!,
      );
      res.status(201).json({ data: doc });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverId, documentId } = req.params as unknown as {
        driverId: number;
        documentId: number;
      };
      const doc = await documentsService.update(
        driverId,
        documentId,
        req.body as UpdateDocumentDto,
        req.user!,
      );
      res.json({ data: doc });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverId, documentId } = req.params as unknown as {
        driverId: number;
        documentId: number;
      };
      await documentsService.remove(driverId, documentId, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverId, documentId } = req.params as unknown as {
        driverId: number;
        documentId: number;
      };
      const file = await documentsService.getForDownload(driverId, documentId, req.user!);
      sendStoredFile(res, file);
    } catch (err) {
      next(err);
    }
  },
};
