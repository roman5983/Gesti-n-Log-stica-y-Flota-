import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { auditLogsService } from './audit-logs.service';
import type { ListAuditLogsQuery } from './audit-logs.schemas';

export const auditLogsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListAuditLogsQuery;
      const { items, total } = await auditLogsService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },
};
