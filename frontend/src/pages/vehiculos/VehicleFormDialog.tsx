import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { vehiclesApi, type Vehicle } from '../../api/vehicles.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create/edit dialog for a vehicle. initialKm is only set on creation
 *  (A-13); the backend blocks changing it once the vehicle has history. */
export function VehicleFormDialog({ open, vehicle, onClose, onSaved }: Props) {
  const isEdit = vehicle !== null;
  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [initialKm, setInitialKm] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLicensePlate(vehicle?.licensePlate ?? '');
      setModel(vehicle?.model ?? '');
      setYear(vehicle ? String(vehicle.year) : '');
      setInitialKm(vehicle ? String(vehicle.initialKm) : '');
      setInsuranceExpiryDate(vehicle?.insuranceExpiryDate?.slice(0, 10) ?? '');
      setError(null);
    }
  }, [open, vehicle]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      licensePlate,
      model,
      year: Number(year),
      initialKm: Number(initialKm),
      ...(insuranceExpiryDate ? { insuranceExpiryDate } : {}),
    };
    try {
      if (isEdit) {
        await vehiclesApi.update(vehicle.id, payload);
      } else {
        await vehiclesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el vehículo'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Patente"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              required
              fullWidth
              inputProps={{ maxLength: 10 }}
            />
            <TextField label="Modelo" value={model} onChange={(e) => setModel(e.target.value)} required fullWidth />
            <TextField
              label="Año"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Kilometraje inicial"
              type="number"
              value={initialKm}
              onChange={(e) => setInitialKm(e.target.value)}
              required
              fullWidth
              helperText={isEdit ? 'Solo editable si el vehículo no tiene viajes ni mantenimientos' : 'Se ingresa manualmente al alta'}
            />
            <TextField
              label="Vencimiento del seguro"
              type="date"
              value={insuranceExpiryDate}
              onChange={(e) => setInsuranceExpiryDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
