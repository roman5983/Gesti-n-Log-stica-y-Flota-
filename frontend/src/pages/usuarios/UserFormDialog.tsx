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
import { usersApi, type User } from '../../api/users.api';
import { apiErrorMessage } from '../../api/axios';

interface UserFormDialogProps {
  open: boolean;
  /** null → create mode; a user → edit mode. */
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create/edit dialog for ADMIN/OPERATOR users. Drivers are managed elsewhere. */
export function UserFormDialog({ open, user, onClose, onSaved }: UserFormDialogProps) {
  const isEdit = user !== null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR'>('OPERATOR');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
      setPassword('');
      setRole(user?.role === 'ADMIN' ? 'ADMIN' : 'OPERATOR');
      setError(null);
    }
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await usersApi.update(user.id, {
          name,
          email,
          role,
          ...(password ? { password } : {}),
        });
      } else {
        await usersApi.create({ name, email, password, role });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el usuario'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
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
              label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!isEdit}
              helperText="Mínimo 8 caracteres, con letras y números"
              fullWidth
            />
            <TextField
              select
              label="Rol"
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'OPERATOR')}
              fullWidth
            >
              <MenuItem value="OPERATOR">Operador</MenuItem>
              <MenuItem value="ADMIN">Administrador</MenuItem>
            </TextField>
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
