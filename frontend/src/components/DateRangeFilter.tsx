import { useMemo } from 'react';
import { Chip, Stack } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';

const DATE_FORMAT = 'YYYY-MM-DD';

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

function toDayjs(value: string): Dayjs | null {
  return value ? dayjs(value, DATE_FORMAT) : null;
}

function fromDayjs(value: Dayjs | null): string {
  return value && value.isValid() ? value.format(DATE_FORMAT) : '';
}

interface Props {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
  size?: 'small' | 'medium';
}

/** "Desde"/"Hasta" range picker (calendar popups, no manual typing) with quick-range shortcuts. */
export function DateRangeFilter({ dateFrom, dateTo, onChange, size = 'small' }: Props) {
  const activeShortcut = useMemo(
    () => SHORTCUTS.find((s) => { const [from, to] = s.range(); return from === dateFrom && to === dateTo; })?.label,
    [dateFrom, dateTo],
  );

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <DatePicker
          label="Desde"
          value={toDayjs(dateFrom)}
          onChange={(v) => onChange(fromDayjs(v), dateTo)}
          maxDate={toDayjs(dateTo) ?? undefined}
          format="DD/MM/YYYY"
          slotProps={{ textField: { size, sx: { minWidth: 170 } } }}
        />
        <DatePicker
          label="Hasta"
          value={toDayjs(dateTo)}
          onChange={(v) => onChange(dateFrom, fromDayjs(v))}
          minDate={toDayjs(dateFrom) ?? undefined}
          format="DD/MM/YYYY"
          slotProps={{ textField: { size, sx: { minWidth: 170 } } }}
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
