import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { tripsApi } from '@/api/trips.api';
import { apiErrorMessage } from '@/api/axios';
import { isoToLocalInput, localInputToIso } from '@/utils/datetime';
import { AddressAutocomplete } from '@/components/AddressAutocomplete/AddressAutocomplete';
import { DateTimeField } from '@/components/DateField/DateField';
import type { TripFormDialogProps } from './TripFormDialog.types';
import { FIXED_ORIGIN } from './TripFormDialog.const';
import { todayLocalInputMin } from './TripFormDialog.helpers';

/** Create/edit a trip (A-1): the route only; driver/vehicle come at assignment.
 *  Editing is limited to trips still pending assignment (A-4). */
export function TripFormDialog({ open, trip = null, onClose, onSaved }: TripFormDialogProps) {
  const isEdit = trip !== null;
  const [destination, setDestination] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDestination(trip?.destination ?? '');
      // Convert the stored ISO instant to a local wall-clock value for the input.
      setDepartureAt(trip?.departureAt ? isoToLocalInput(trip.departureAt) : '');
      setNotes(trip?.notes ?? '');
      setError(null);
    }
  }, [open, trip]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (departureAt < todayLocalInputMin()) {
      setError('La fecha de salida no puede ser anterior a hoy');
      return;
    }
    setSubmitting(true);
    try {
      // Send an unambiguous UTC instant, independent of the server's timezone.
      const payload = { destination, departureAt: localInputToIso(departureAt), ...(notes ? { notes } : {}) };
      if (isEdit) {
        await tripsApi.update(trip.id, payload);
      } else {
        await tripsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el viaje'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Editar viaje' : 'Nuevo viaje'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Origen (fijo)
              </Typography>
              <Typography variant="body2">{FIXED_ORIGIN}</Typography>
            </Stack>
            <AddressAutocomplete label="Destino" value={destination} onChange={setDestination} required />
            <DateTimeField
              label="Fecha y hora de salida"
              value={departureAt}
              onChange={setDepartureAt}
              required
              fullWidth
              minDate={todayLocalInputMin().slice(0, 10)}
            />
            <TextField label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={submitting}>{isEdit ? 'Guardar' : 'Crear'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
