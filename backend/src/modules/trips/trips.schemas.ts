import { z } from 'zod';
import { paginationSchema, searchSchema } from '../../shared/schemas';
import { utcStartOfToday } from '../../shared/utils/dates';

/** RN: a trip's departure cannot be scheduled before today's calendar date. */
const notBeforeToday = (date: Date) => date >= utcStartOfToday();
const NOT_BEFORE_TODAY_MESSAGE = 'La fecha de salida no puede ser anterior a hoy';

/**
 * Trip creation only generates the route (A-1). The origin is fixed (RN-21)
 * and therefore NOT accepted from the client. Driver and vehicle are set
 * later, during assignment. estimatedDistanceKm/estimatedTimeMin come from
 * the route preview (Google Maps) and are optional.
 */
export const createTripSchema = z.object({
  destination: z.string().min(2).max(120),
  departureAt: z.coerce.date().refine(notBeforeToday, { message: NOT_BEFORE_TODAY_MESSAGE }),
  notes: z.string().max(1000).optional(),
  estimatedDistanceKm: z.coerce.number().positive().max(99999).optional(),
  estimatedTimeMin: z.coerce.number().int().positive().max(100000).optional(),
});
export type CreateTripDto = z.infer<typeof createTripSchema>;

/** Editable only while PENDING_ASSIGNMENT (RN-22 / A-4), enforced in service. */
export const updateTripSchema = z
  .object({
    destination: z.string().min(2).max(120).optional(),
    departureAt: z.coerce.date().refine(notBeforeToday, { message: NOT_BEFORE_TODAY_MESSAGE }).optional(),
    notes: z.string().max(1000).nullable().optional(),
    estimatedDistanceKm: z.coerce.number().positive().max(99999).nullable().optional(),
    estimatedTimeMin: z.coerce.number().int().positive().max(100000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Se requiere al menos un campo' });
export type UpdateTripDto = z.infer<typeof updateTripSchema>;

/**
 * Assignment: the operator picks the driver; the vehicle is chosen
 * automatically by the system among AVAILABLE ones (RN-12 / C-8).
 */
export const assignTripSchema = z.object({
  driverId: z.coerce.number().int().positive(),
});
export type AssignTripDto = z.infer<typeof assignTripSchema>;

/** Finishing requires the final odometer reading; RN-5 checked in service. */
export const finishTripSchema = z.object({
  arrivalKm: z.coerce.number().int().min(0),
});
export type FinishTripDto = z.infer<typeof finishTripSchema>;

export const listTripsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING_ASSIGNMENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  driverId: z.coerce.number().int().positive().optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  /** Matches the assigned driver's name OR the destination (P-OP-3 search box). */
  search: searchSchema,
});
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
