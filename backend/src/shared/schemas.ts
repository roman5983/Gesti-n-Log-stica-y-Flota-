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

/**
 * Free-text search box of a listing. Trimmed; blank means "no search" so the
 * frontend can always send what the user typed. Matching is done by MySQL with
 * the column collation (utf8mb4 *_ci): case- and accent-insensitive, so
 * "perez" finds "Pérez".
 */
export const searchSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));

/** Direction of a listing's sort control. Newest-first is the natural default. */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export function paginationMeta(pagination: Pagination, total: number) {
  return { page: pagination.page, limit: pagination.limit, total };
}
