import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { tripsApi, type Trip } from '../../api/trips.api';
import { apiErrorMessage } from '../../api/axios';
import { RouteMap } from '../../components/RouteMap';
import { FinishTripDialog } from '../viajes/FinishTripDialog';

/** Driver's current trip (P-CH-2). The list endpoint already scopes to the
 *  driver's own trips server-side. */
export function MiViajePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { items } = await tripsApi.list({ page: 1, limit: 1, status: 'IN_PROGRESS' });
      setTrip(items[0] ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;

  if (!trip) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={1} alignItems="center" sx={{ py: 4 }}>
            <LocalShippingIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography color="text.secondary">No tenés un viaje asignado en este momento.</Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Mi viaje actual</Typography>
        <Chip label="EN VIAJE" color="info" size="small" />
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Row label="N° de viaje" value={`VJ-${String(trip.id).padStart(6, '0')}`} />
            <Row label="Origen" value={trip.origin} />
            <Row label="Destino" value={trip.destination} />
            <Row label="Vehículo" value={trip.vehicle ? `${trip.vehicle.licensePlate} — ${trip.vehicle.model}` : '—'} />
            <Row label="Salida" value={new Date(trip.departureAt).toLocaleString('es-AR')} />
            {trip.estimatedDistanceKm != null && <Row label="Distancia estimada" value={`${trip.estimatedDistanceKm} km`} />}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 2 }}>
        <RouteMap origin={trip.origin} destination={trip.destination} height={220} />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Button variant="contained" color="error" fullWidth size="large" onClick={() => setFinishOpen(true)}>
        Cerrar hoja de ruta
      </Button>

      <FinishTripDialog
        open={finishOpen}
        trip={trip}
        onClose={() => setFinishOpen(false)}
        onSaved={() => { setFinishOpen(false); void load(); }}
      />
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}
