import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { maintenanceTypesService } from './maintenance-types.service';
import type {
  CreateMaintenanceTypeDto,
  ListMaintenanceTypesQuery,
  UpdateMaintenanceTypeDto,
} from './maintenance-types.schemas';

export const maintenanceTypesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListMaintenanceTypesQuery;
      const { items, total } = await maintenanceTypesService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await maintenanceTypesService.getById(id) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = await maintenanceTypesService.create(
        req.body as CreateMaintenanceTypeDto,
        req.user!.id,
      );
      res.status(201).json({ data: type });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const type = await maintenanceTypesService.update(
        id,
        req.body as UpdateMaintenanceTypeDto,
        req.user!.id,
      );
      res.json({ data: type });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      await maintenanceTypesService.delete(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
