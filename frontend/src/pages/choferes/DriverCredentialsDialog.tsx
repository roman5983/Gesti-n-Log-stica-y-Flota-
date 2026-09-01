import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import { driversApi, type Driver } from '../../api/drivers.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
}

/**
 * Admin-only credentials management (A-9): view the current password
 * (decrypted, leaves an audit trail) and set a new one. Both are separate,
 * deliberate actions.
 */
export function DriverCredentialsDialog({ open, driver, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword(null);
      setNewPassword('');
      setError(null);
      setSuccess(null);
    }
  }, [open, driver]);

  async function handleReveal() {
    if (!driver) return;
    setError(null);
    setBusy(true);
    try {
      setCurrentPassword(await driversApi.getPassword(driver.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleChange() {
    if (!driver) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await driversApi.changePassword(driver.id, newPassword);
      setNewPassword('');
      setSuccess('Contraseña actualizada. Las sesiones del chofer fueron cerradas.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Credenciales de {driver?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <Stack spacing={1}>
            <Typography variant="subtitle2">Contraseña actual</Typography>
            {currentPassword === null ? (
              <Button variant="outlined" startIcon={<Visibility />} onClick={handleReveal} disabled={busy}>
                Ver contraseña
              </Button>
            ) : (
              <TextField
                value={currentPassword}
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: <InputAdornment position="end"><IconButton disabled><Visibility /></IconButton></InputAdornment>,
                }}
              />
            )}
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Cambiar contraseña</Typography>
            <TextField
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              helperText="Mínimo 8 caracteres, con letras y números"
            />
            <Button variant="contained" onClick={handleChange} disabled={busy || newPassword.length < 8}>
              Actualizar contraseña
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
