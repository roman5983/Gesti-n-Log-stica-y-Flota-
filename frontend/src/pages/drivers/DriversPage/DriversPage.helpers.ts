import type { Driver } from '@/api/drivers.api';

/**
 * Why a driver cannot be assigned a trip today (RN-1, RN-4, RN-19), for the
 * "Disponible" column's tooltip. Empty when the driver is available. The API
 * doesn't send the "on a trip" flag on its own: when every other condition
 * holds and the driver still isn't available, that's the reason.
 */
export function unavailabilityReasons(d: Driver): string[] {
  if (d.available) return [];
  const reasons: string[] = [];
  if (!d.isActive) reasons.push('Usuario inactivo');
  if (!d.licenseValid) reasons.push('Licencia vencida');
  if (!d.documentsComplete) reasons.push('Documentación incompleta o vencida');
  if (reasons.length === 0) reasons.push('Tiene un viaje en curso');
  return reasons;
}
