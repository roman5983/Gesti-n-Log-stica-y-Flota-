import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { alertsService } from './alerts.service';
import type { ListAlertsQuery } from './alerts.schemas';

export const alertsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListAlertsQuery;
      const { items, total } = await alertsService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async evaluate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await alertsService.evaluate(req.user!.id);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await alertsService.resolve(id, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },
};
