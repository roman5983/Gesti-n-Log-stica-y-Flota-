import { z } from 'zod';

/**
 * Trip report over a selectable period (A-11). Both bounds are required;
 * dateTo must not precede dateFrom. The period is inclusive of full days:
 * the service normalizes dateTo to the end of that day. The span is capped at
 * MAX_REPORT_DAYS so a single request cannot aggregate the whole history.
 */
export const MAX_REPORT_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export const reportQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    path: ['dateTo'],
    message: 'La fecha "hasta" debe ser igual o posterior a la fecha "desde"',
  })
  .refine((data) => data.dateTo.getTime() - data.dateFrom.getTime() < MAX_REPORT_DAYS * DAY_MS, {
    path: ['dateTo'],
    message: `El período del informe no puede superar ${MAX_REPORT_DAYS} días`,
  });
export type ReportQuery = z.infer<typeof reportQuerySchema>;
