import type { NextFunction, Request, Response } from 'express';
import { dashboardService } from './dashboard.service';

export const dashboardController = {
  async metrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ data: await dashboardService.metrics() });
    } catch (err) {
      next(err);
    }
  },
};
