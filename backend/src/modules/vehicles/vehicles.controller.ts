import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { vehiclesService } from './vehicles.service';
import type { CreateVehicleDto, ListVehiclesQuery, UpdateVehicleDto } from './vehicles.schemas';

export const vehiclesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListVehiclesQuery;
      const { items, total } = await vehiclesService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await vehiclesService.getById(id) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicle = await vehiclesService.create(req.body as CreateVehicleDto, req.user!.id);
      res.status(201).json({ data: vehicle });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const vehicle = await vehiclesService.update(id, req.body as UpdateVehicleDto, req.user!.id);
      res.json({ data: vehicle });
    } catch (err) {
      next(err);
    }
  },

  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await vehiclesService.activate(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await vehiclesService.deactivate(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      await vehiclesService.softDelete(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
