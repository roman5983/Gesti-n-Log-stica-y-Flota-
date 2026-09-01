import { z } from 'zod';

/**
 * Trip report over a selectable period (A-11). Both bounds are required;
 * dateTo must not precede dateFrom. The period is inclusive of full days:
 * the service normalizes dateTo to the end of that day.
 */
export const reportQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    path: ['dateTo'],
    message: 'dateTo must be greater than or equal to dateFrom',
  });
export type ReportQuery = z.infer<typeof reportQuerySchema>;
