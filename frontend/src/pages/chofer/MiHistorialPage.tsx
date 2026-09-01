import { useCallback } from 'react';
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { tripsApi, type Trip } from '../../api/trips.api';

/** Driver's completed trips (P-CH-5). Scoped to the driver server-side. */
export function MiHistorialPage() {
  const fetchFn = useCallback(
    (params: PageParams) => tripsApi.list({ ...params, status: 'COMPLETED' }),
    [],
  );
  const { items, loading, error } = usePaginatedList<Trip>(fetchFn, 50);

  return (
    <Box>
      <PageHeader title="Historial" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!loading && items.length === 0 && (
        <Typography color="text.secondary">Todavía no realizaste viajes.</Typography>
      )}
      <Stack spacing={1.5}>
        {items.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack>
                  <Typography variant="subtitle2">VJ-{String(t.id).padStart(6, '0')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t.destination}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.finishedAt ? new Date(t.finishedAt).toLocaleDateString('es-AR') : ''} · {t.vehicle?.licensePlate ?? ''}
                  </Typography>
                </Stack>
                <Chip label="FINALIZADO" color="success" size="small" />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
