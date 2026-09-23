import { useMemo } from 'react';
import { Chip, Stack } from '@mui/material';
import dayjs from 'dayjs';
import { DateField } from './DateField';
import { VALUE_FORMAT } from '../utils/date-input';

const DATE_FORMAT = VALUE_FORMAT.date;

interface Shortcut {
  label: string;
  range: () => [string, string];
}

/** Quick presets for a "Desde"/"Hasta" range, so users don't have to pick both dates by hand. */
const SHORTCUTS: Shortcut[] = [
  { label: 'Hoy', range: () => { const t = dayjs().format(DATE_FORMAT); return [t, t]; } },
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

interface Props {
  /** 'YYYY-MM-DD' or '' (open-ended). */
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
  size?: 'small' | 'medium';
}

/**
 * "Desde"/"Hasta" filter (Viajes, Reportes, Auditoría): two DateFields —
 * typed dd/mm/aaaa or picked year → month → day — plus quick-range shortcuts.
 * Each end bounds the other, so an inverted range is flagged on the field.
 */
export function DateRangeFilter({ dateFrom, dateTo, onChange, size = 'small' }: Props) {
  const activeShortcut = useMemo(
    () => SHORTCUTS.find((s) => { const [from, to] = s.range(); return from === dateFrom && to === dateTo; })?.label,
    [dateFrom, dateTo],
  );

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <DateField
          label="Desde"
          value={dateFrom}
          onChange={(v) => onChange(v, dateTo)}
          maxDate={dateTo || undefined}
          size={size}
          sx={{ minWidth: 180 }}
        />
        <DateField
          label="Hasta"
          value={dateTo}
          onChange={(v) => onChange(dateFrom, v)}
          minDate={dateFrom || undefined}
          size={size}
          sx={{ minWidth: 180 }}
        />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {SHORTCUTS.map((s) => (
          <Chip
            key={s.label}
            label={s.label}
            size="small"
            variant={activeShortcut === s.label ? 'filled' : 'outlined'}
            color={activeShortcut === s.label ? 'primary' : 'default'}
            onClick={() => { const [from, to] = s.range(); onChange(from, to); }}
          />
        ))}
        {(dateFrom || dateTo) && (
          <Chip label="Limpiar" size="small" variant="outlined" onClick={() => onChange('', '')} />
        )}
      </Stack>
    </Stack>
  );
}
