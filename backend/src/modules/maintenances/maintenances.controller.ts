import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { paginationMeta } from '../../shared/schemas';
import { maintenancesService } from './maintenances.service';
import type {
  CreateMaintenanceDto,
  ListMaintenancesQuery,
  UpdateMaintenanceDto,
} from './maintenances.schemas';

export const maintenancesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListMaintenancesQuery;
      const { items, total } = await maintenancesService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await maintenancesService.getById(id) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const maintenance = await maintenancesService.create(
        req.body as CreateMaintenanceDto,
        req.user!.id,
      );
      res.status(201).json({ data: maintenance });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const maintenance = await maintenancesService.update(
        id,
        req.body as UpdateMaintenanceDto,
        req.user!.id,
      );
      res.json({ data: maintenance });
    } catch (err) {
      next(err);
    }
  },

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await maintenancesService.start(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await maintenancesService.complete(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async addAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new BadRequestError('A file is required (field name: "file")');
      const { id } = req.params as unknown as { id: number };
      const maintenance = await maintenancesService.addAttachment(id, req.file, req.user!.id);
      res.status(201).json({ data: maintenance });
    } catch (err) {
      next(err);
    }
  },

  async downloadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, attachmentId } = req.params as unknown as { id: number; attachmentId: number };
      const file = await maintenancesService.getAttachment(id, attachmentId);
      res.type(file.mimeType);
      // inline so the receipt can be viewed in the browser (mockup: "visualizar");
      // the original name is offered for saving.
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
      res.sendFile(path.resolve(file.filePath), (err) => {
        // File recorded in DB but missing on disk (e.g. manual removal).
        if (err && !res.headersSent) next(new NotFoundError('File is no longer available'));
      });
    } catch (err) {
      next(err);
    }
  },
};
