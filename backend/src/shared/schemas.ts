import { z } from 'zod';

/** Shared request schemas — one definition, reused by every module. */

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export function paginationMeta(pagination: Pagination, total: number) {
  return { page: pagination.page, limit: pagination.limit, total };
}
