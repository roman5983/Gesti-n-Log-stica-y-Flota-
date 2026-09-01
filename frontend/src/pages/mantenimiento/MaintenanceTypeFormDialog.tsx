import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
} from '@mui/material';
import { maintenanceTypesApi, type MaintenanceType } from '../../api/maintenance-types.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  type: MaintenanceType | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create/edit dialog for a maintenance type. Full-set semantics (PUT): the
 *  km/months thresholds are always submitted together (kmTarget ≥ kmAlert). */
export function MaintenanceTypeFormDialog({ open, type, onClose, onSaved }: Props) {
  const isEdit = type !== null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kmAlert, setKmAlert] = useState('');
  const [kmTarget, setKmTarget] = useState('');
  const [monthsAlert, setMonthsAlert] = useState('');
  const [monthsTarget, setMonthsTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(type?.name ?? '');
      setDescription(type?.description ?? '');
      setKmAlert(type ? String(type.kmAlert) : '');
      setKmTarget(type ? String(type.kmTarget) : '');
      setMonthsAlert(type?.monthsAlert != null ? String(type.monthsAlert) : '');
      setMonthsTarget(type?.monthsTarget != null ? String(type.monthsTarget) : '');
      setError(null);
    }
  }, [open, type]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload = {
      name,
      description,
      kmAlert: Number(kmAlert),
      kmTarget: Number(kmTarget),
      ...(monthsAlert ? { monthsAlert: Number(monthsAlert) } : {}),
      ...(monthsTarget ? { monthsTarget: Number(monthsTarget) } : {}),
    };
    try {
      if (isEdit) {
        await maintenanceTypesApi.update(type.id, payload);
      } else {
        await maintenanceTypesApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el tipo de mantenimiento'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Editar tipo de mantenimiento' : 'Nuevo tipo de mantenimiento'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
            <TextField
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              fullWidth
              multiline
              minRows={2}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField label="Km de alerta" type="number" value={kmAlert} onChange={(e) => setKmAlert(e.target.value)} required fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Km objetivo" type="number" value={kmTarget} onChange={(e) => setKmTarget(e.target.value)} required fullWidth helperText="≥ km de alerta" />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Meses de alerta (opc.)" type="number" value={monthsAlert} onChange={(e) => setMonthsAlert(e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Meses objetivo (opc.)" type="number" value={monthsTarget} onChange={(e) => setMonthsTarget(e.target.value)} fullWidth />
              </Grid>
            </Grid>
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
