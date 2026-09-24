import dayjs from 'dayjs';
import type { Shortcut } from './DateRangeFilter.types';
import { DATE_FORMAT } from './DateRangeFilter.const';

/** Quick presets for a "Desde"/"Hasta" range, so users don't have to pick both dates by hand. */
export const SHORTCUTS: Shortcut[] = [
  { label: 'Hoy', range: () => { const t = dayjs().format(DATE_FORMAT); return [t, t]; } },
  {
    // Monday to Sunday of the current week (Argentine calendar), regardless of
    // the dayjs locale's first day of the week.
    label: 'Esta semana',
    range: () => {
      const monday = dayjs().subtract((dayjs().day() + 6) % 7, 'day');
      return [monday.format(DATE_FORMAT), monday.add(6, 'day').format(DATE_FORMAT)];
    },
  },
  {
    label: 'Últimos 7 días',
    range: () => [dayjs().subtract(6, 'day').format(DATE_FORMAT), dayjs().format(DATE_FORMAT)],
  },
  {
    label: 'Últimos 30 días',
    range: () => [dayjs().subtract(29, 'day').format(DATE_FORMAT), dayjs().format(DATE_FORMAT)],
  },
  {
    label: 'Este mes',
    range: () => [dayjs().startOf('month').format(DATE_FORMAT), dayjs().endOf('month').format(DATE_FORMAT)],
  },
  {
    label: 'Mes anterior',
    range: () => {
      const prev = dayjs().subtract(1, 'month');
      return [prev.startOf('month').format(DATE_FORMAT), prev.endOf('month').format(DATE_FORMAT)];
    },
  },
];
