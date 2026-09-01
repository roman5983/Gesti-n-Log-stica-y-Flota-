import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { tripsService } from './trips.service';
import type {
  AssignTripDto,
  CreateTripDto,
  FinishTripDto,
  ListTripsQuery,
  UpdateTripDto,
} from './trips.schemas';

export const tripsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListTripsQuery;
      const { items, total } = await tripsService.list(query, req.user!);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await tripsService.getById(id, req.user!) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await tripsService.create(req.body as CreateTripDto, req.user!.id);
      res.status(201).json({ data: trip });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const trip = await tripsService.update(id, req.body as UpdateTripDto, req.user!.id);
      res.json({ data: trip });
    } catch (err) {
      next(err);
    }
  },

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const trip = await tripsService.assign(id, req.body as AssignTripDto, req.user!.id);
      res.json({ data: trip });
    } catch (err) {
      next(err);
    }
  },

  async finish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const trip = await tripsService.finish(id, req.body as FinishTripDto, req.user!);
      res.json({ data: trip });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      await tripsService.delete(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
