import type { NextFunction, Request, Response } from 'express';
import { settingsService } from './settings.service';
import type { UpdateSettingsDto } from './settings.schemas';

export const settingsController = {
  async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ data: await settingsService.get() });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.update(req.body as UpdateSettingsDto, req.user!.id);
      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  },
};
