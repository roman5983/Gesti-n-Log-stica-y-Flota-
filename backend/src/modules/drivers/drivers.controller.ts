import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { driversService } from './drivers.service';
import type {
  ChangeDriverPasswordDto,
  CreateDriverDto,
  ListDriversQuery,
  UpdateDriverDto,
} from './drivers.schemas';

export const driversController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListDriversQuery;
      const { items, total } = await driversService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await driversService.getById(id) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const driver = await driversService.create(req.body as CreateDriverDto, req.user!.id);
      res.status(201).json({ data: driver });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const driver = await driversService.update(id, req.body as UpdateDriverDto, req.user!.id);
      res.json({ data: driver });
    } catch (err) {
      next(err);
    }
  },

  async getPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await driversService.getPassword(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      await driversService.changePassword(id, req.body as ChangeDriverPasswordDto, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
