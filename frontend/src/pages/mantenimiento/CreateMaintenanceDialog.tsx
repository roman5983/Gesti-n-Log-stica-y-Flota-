import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { maintenancesApi } from '../../api/maintenances.api';
import { vehiclesApi, type Vehicle } from '../../api/vehicles.api';
import { maintenanceTypesApi, type MaintenanceType } from '../../api/maintenance-types.api';
import { apiErrorMessage } from '../../api/axios';
import { localInputToIso } from '../../utils/datetime';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Register (schedule) a maintenance: born PENDING (C-6). */
export function CreateMaintenanceDialog({ open, onClose, onSaved }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [types, setTypes] = useState<MaintenanceType[]>([]);
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [maintenanceTypeId, setMaintenanceTypeId] = useState<number | ''>('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [km, setKm] = useState('');
  const [nextMaintenanceKm, setNextMaintenanceKm] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVehicleId('');
    setMaintenanceTypeId('');
    setScheduledAt('');
    setKm('');
    setNextMaintenanceKm('');
    setNotes('');
    setError(null);
    Promise.all([
      vehiclesApi.list({ page: 1, limit: 100 }),
      maintenanceTypesApi.list({ page: 1, limit: 100 }),
    ])
      .then(([v, t]) => {
        setVehicles(v.items);
        setTypes(t.items);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (vehicleId === '' || maintenanceTypeId === '') return;
    setError(null);
    setSubmitting(true);
    try {
      await maintenancesApi.create({
        vehicleId,
        maintenanceTypeId,
        scheduledAt: localInputToIso(scheduledAt),
        km: Number(km),
        ...(nextMaintenanceKm ? { nextMaintenanceKm: Number(nextMaintenanceKm) } : {}),
        ...(notes ? { notes } : {}),
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo registrar el mantenimiento'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Registrar mantenimiento</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label="Vehículo" value={vehicleId} onChange={(e) => setVehicleId(Number(e.target.value))} required fullWidth>
              {vehicles.map((v) => (
                <MenuItem key={v.id} value={v.id}>{v.licensePlate} — {v.model}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Tipo de mantenimiento" value={maintenanceTypeId} onChange={(e) => setMaintenanceTypeId(Number(e.target.value))} required fullWidth>
              {types.map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha programada"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField label="Kilometraje" type="number" value={km} onChange={(e) => setKm(e.target.value)} required fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Próximo mant. (km, opc.)" type="number" value={nextMaintenanceKm} onChange={(e) => setNextMaintenanceKm(e.target.value)} fullWidth helperText="≥ kilometraje" />
              </Grid>
            </Grid>
            <TextField label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={submitting}>Registrar</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
