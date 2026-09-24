import type { AlertPresentation } from './AlertCard.types';
import { ICONS, TYPES } from './AlertCard.data';

/**
 * How each alert type looks (P-AD-4 alert cards).
 *
 * Two independent visual channels, so an alert can be told apart at a glance
 * and not only by reading it:
 *  - the ICON says what it is about (license, document, insurance,
 *    maintenance, idle vehicle);
 *  - the COLOR says how urgent it is, with the semantic palette: red = already
 *    expired, amber = about to expire / needs action, cyan = informative.
 * The title and the "Vencida" / "Por vencer" tag repeat the meaning in words,
 * so nothing depends on color alone (WCAG 1.4.1).
 */

/**
 * Presentation of an alert type. The taxonomy is open (C-4): a type the
 * frontend does not know yet still renders — with its raw code, a bell and
 * the informative tone — instead of breaking the list.
 */
export function alertPresentation(alertType: string): AlertPresentation {
  const known = TYPES[alertType];
  if (!known) return { label: alertType, category: 'other', icon: ICONS.other, tone: 'info' };
  return { ...known, icon: ICONS[known.category] };
}

export function alertLabel(alertType: string): string {
  return alertPresentation(alertType).label;
}
