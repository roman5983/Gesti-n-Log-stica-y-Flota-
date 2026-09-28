import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { usersApi } from '@/api/users.api';
import { apiErrorMessage } from '@/api/axios';
import type { EditProfileDialogProps } from './EditProfileDialog.types';
import { formValidationError } from '@/utils/form-validation';

/**
 * Self-service edit for an Admin's own account (name/email/password), from
 * "Mis datos". No role field: the backend refuses a role change on your own
 * account (it would risk locking every admin out), so it's not offered here.
 */
export function EditProfileDialog({ open, profile, onClose, onSaved }: EditProfileDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setEmail(profile.email);
      setPassword('');
      setError(null);
    }
  }, [open, profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = formValidationError(e.currentTarget as HTMLFormElement);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await usersApi.update(profile.id, { name, email, ...(password ? { password } : {}) });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron guardar los cambios'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Editar mis datos</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Nueva contraseña (opcional)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Mínimo 8 caracteres, con letras y números. Si la cambiás, vas a tener que volver a iniciar sesión."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
