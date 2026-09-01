import type { NextFunction, Request, Response } from 'express';
import { paginationMeta } from '../../shared/schemas';
import { usersService } from './users.service';
import type { CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.schemas';

/** Controllers only translate HTTP ↔ service calls (Stage 1 convention). */
export const usersController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListUsersQuery;
      const { items, total } = await usersService.list(query);
      res.json({ data: items, meta: paginationMeta(query, total) });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await usersService.getById(id) });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.create(req.body as CreateUserDto, req.user!.id);
      res.status(201).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      const user = await usersService.update(id, req.body as UpdateUserDto, req.user!.id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await usersService.setActive(id, true, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      res.json({ data: await usersService.setActive(id, false, req.user!.id) });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as unknown as { id: number };
      await usersService.softDelete(id, req.user!.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
