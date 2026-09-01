import { useEffect, useState, type FormEvent } from 'react';
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
} from '@mui/material';
import { driversApi, type Driver, type LicenseCategory } from '../../api/drivers.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES: LicenseCategory[] = ['A', 'B', 'C', 'E'];

/** Create/edit dialog for a driver (user + profile + license, C-2). */
export function DriverFormDialog({ open, driver, onClose, onSaved }: Props) {
  const isEdit = driver !== null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dni, setDni] = useState('');
  const [licenseCategory, setLicenseCategory] = useState<LicenseCategory>('B');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(driver?.name ?? '');
      setEmail(driver?.email ?? '');
      setPassword('');
      setDni(driver?.dni ?? '');
      setLicenseCategory(driver?.licenseCategory ?? 'B');
      setLicenseExpiryDate(driver?.licenseExpiryDate?.slice(0, 10) ?? '');
      setError(null);
    }
  }, [open, driver]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await driversApi.update(driver.id, { name, email, dni, licenseCategory, licenseExpiryDate });
      } else {
        await driversApi.create({ name, email, password, dni, licenseCategory, licenseExpiryDate });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el chofer'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Editar chofer' : 'Nuevo chofer'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            {!isEdit && (
              <TextField
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                helperText="Mínimo 8 caracteres, con letras y números"
              />
            )}
            <TextField label="DNI" value={dni} onChange={(e) => setDni(e.target.value)} required fullWidth inputProps={{ maxLength: 10 }} />
            <TextField
              select
              label="Categoría de licencia"
              value={licenseCategory}
              onChange={(e) => setLicenseCategory(e.target.value as LicenseCategory)}
              fullWidth
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Vencimiento de licencia"
              type="date"
              value={licenseExpiryDate}
              onChange={(e) => setLicenseExpiryDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
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
