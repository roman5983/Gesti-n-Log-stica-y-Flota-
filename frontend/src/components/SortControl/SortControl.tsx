import { IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { SortOrder, SortControlProps } from './SortControl.types';

/**
 * "Ordenar por" control: a field select plus a direction toggle. Shared by
 * every list that can be sorted (Alertas, Mantenimiento) so it looks and
 * behaves the same everywhere. The toggle says in words what the current
 * direction means for the chosen field, instead of relying on the arrow alone.
 */
export function SortControl<K extends string>({ options, sortBy, sortOrder, onChange, size = 'small' }: SortControlProps<K>) {
  const current = options.find((o) => o.value === sortBy);
  const directionLabel =
    sortOrder === 'asc' ? (current?.ascLabel ?? 'Ascendente') : (current?.descLabel ?? 'Descendente');
  const nextOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <TextField
        select
        label="Ordenar por"
        size={size}
        value={sortBy}
        onChange={(e) => onChange(e.target.value as K, sortOrder)}
        sx={{ minWidth: 190 }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <Tooltip title={`${directionLabel} (clic para invertir)`}>
        <IconButton
          aria-label={`Orden: ${directionLabel}. Invertir`}
          onClick={() => onChange(sortBy, nextOrder)}
        >
          {sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
