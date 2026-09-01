import type { NextFunction, Request, Response } from 'express';
import { reportsService } from './reports.service';
import type { ReportQuery } from './reports.schemas';

export const reportsController = {
  async tripReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ReportQuery;
      res.json({ data: await reportsService.tripReport(query) });
    } catch (err) {
      next(err);
    }
  },
};
