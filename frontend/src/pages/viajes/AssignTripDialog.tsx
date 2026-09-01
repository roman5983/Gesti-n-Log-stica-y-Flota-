import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { tripsApi, type Trip } from '../../api/trips.api';
import { driversApi, type Driver } from '../../api/drivers.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Assign a trip: the operator selects an available driver; the system picks
 * the vehicle automatically (RN-12). Only available drivers are offered.
 */
export function AssignTripDialog({ open, trip, onClose, onSaved }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState<number | ''>('');
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDriverId('');
    setError(null);
    setLoadingDrivers(true);
    driversApi
      .list({ page: 1, limit: 100, available: true })
      .then((r) => setDrivers(r.items))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingDrivers(false));
  }, [open]);

  async function handleAssign() {
    if (!trip || driverId === '') return;
    setError(null);
    setSubmitting(true);
    try {
      await tripsApi.assign(trip.id, driverId);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo asignar el viaje'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Asignar viaje</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Destino: <strong>{trip?.destination}</strong>
          </Typography>
          <TextField
            select
            label="Chofer"
            value={driverId}
            onChange={(e) => setDriverId(Number(e.target.value))}
            fullWidth
            disabled={loadingDrivers}
            helperText={
              loadingDrivers
                ? 'Cargando choferes disponibles…'
                : drivers.length === 0
                  ? 'No hay choferes disponibles'
                  : 'Solo se listan choferes disponibles (licencia vigente, sin viaje activo)'
            }
          >
            {drivers.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name} — DNI {d.dni} (Cat. {d.licenseCategory})
              </MenuItem>
            ))}
          </TextField>
          <Alert severity="info">
            El vehículo se asigna automáticamente entre los disponibles según reglas de negocio.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="contained" onClick={handleAssign} disabled={submitting || driverId === ''}>
          Asignar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
