import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { tripsApi, type Trip } from '../../api/trips.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Finish a trip (RN-5): arrival km must be greater than departure km. */
export function FinishTripDialog({ open, trip, onClose, onSaved }: Props) {
  const [arrivalKm, setArrivalKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setArrivalKm('');
      setError(null);
    }
  }, [open]);

  async function handleFinish() {
    if (!trip) return;
    setError(null);
    setSubmitting(true);
    try {
      await tripsApi.finish(trip.id, Number(arrivalKm));
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo finalizar el viaje'));
    } finally {
      setSubmitting(false);
    }
  }

  const departureKm = trip?.departureKm ?? 0;
  const invalid = arrivalKm === '' || Number(arrivalKm) <= departureKm;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Finalizar viaje</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Ingresá el kilometraje final del vehículo para finalizar el viaje.
          </Typography>
          <TextField
            label="Kilometraje final"
            type="number"
            value={arrivalKm}
            onChange={(e) => setArrivalKm(e.target.value)}
            required
            fullWidth
            helperText={`Debe ser mayor al inicial (${departureKm.toLocaleString('es-AR')} km)`}
            error={arrivalKm !== '' && Number(arrivalKm) <= departureKm}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button variant="contained" color="error" onClick={handleFinish} disabled={submitting || invalid}>
          Finalizar viaje
        </Button>
      </DialogActions>
    </Dialog>
  );
}
