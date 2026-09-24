import { useMemo } from 'react';
import { Chip, Stack } from '@mui/material';
import { DateField } from '@/components/DateField/DateField';
import type { DateRangeFilterProps } from './DateRangeFilter.types';
import { SHORTCUTS } from './DateRangeFilter.data';

/**
 * "Desde"/"Hasta" filter (Viajes, Reportes, Auditoría): two DateFields —
 * typed dd/mm/aaaa or picked year → month → day — plus quick-range shortcuts.
 * Each end bounds the other, so an inverted range is flagged on the field.
 */
export function DateRangeFilter({ dateFrom, dateTo, onChange, size = 'small' }: DateRangeFilterProps) {
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
