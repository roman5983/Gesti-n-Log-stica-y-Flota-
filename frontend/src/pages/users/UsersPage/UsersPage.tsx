import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable.types';
import { StatusChip } from '@/components/StatusChip/StatusChip';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { usersApi, ADMINISTRATIVE_ROLES, type User } from '@/api/users.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { useAuth } from '@/hooks/useAuth';
import { UserFormDialog } from '@/pages/users/UserFormDialog/UserFormDialog';
import type { AdminRoleFilter } from './UsersPage.types';

export function UsersPage() {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<AdminRoleFilter>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      usersApi.list({
        ...params,
        // Empty filter → all administrative roles (never drivers).
        role: roleFilter || ADMINISTRATIVE_ROLES,
        search: appliedSearch || undefined,
      }),
    [roleFilter, appliedSearch],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<User>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  // Stable across renders (only setState) so the `columns` memo below stays valid.
  const openEdit = useCallback((user: User) => {
    setEditing(user);
    setFormOpen(true);
  }, []);

  const toggleActive = useCallback(
    async (user: User) => {
      try {
        await usersApi.setActive(user.id, !user.isActive);
        notify.success(`${user.name} ${user.isActive ? 'desactivado' : 'activado'}`);
        await reload();
      } catch (err) {
        // One-click action (no dialog): the reason goes in a pop-up notice
        // (e.g. "no se puede desactivar al último administrador").
        notify.error(apiErrorMessage(err));
      }
    },
    [reload, notify],
  );

  const askDelete = useCallback((user: User) => {
    setActionError(null);
    setToDelete(user);
  }, []);

  function cancelDelete() {
    setActionError(null);
    setToDelete(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const deletingSelf = toDelete.id === currentUser?.id;
    setBusy(true);
    setActionError(null);
    try {
      await usersApi.remove(toDelete.id);
      notify.success(`Usuario ${toDelete.name} eliminado`);
      setToDelete(null);
      if (deletingSelf) {
        // Own account gone: the session is revoked server-side — end it here too.
        await logout();
        navigate('/login', { replace: true });
        return;
      }
      await reload();
    } catch (err) {
      // Keep the dialog open so the reason (e.g. last-admin rule) is shown in context.
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<Column<User>[]>(
    () => [
      { key: 'id', label: 'ID', render: (u) => u.id },
      { key: 'name', label: 'Nombre', render: (u) => u.name },
      { key: 'email', label: 'Email', render: (u) => u.email },
      { key: 'role', label: 'Rol', render: (u) => <StatusChip status={u.role} /> },
      {
        key: 'status',
        label: 'Estado',
        render: (u) => <StatusChip status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />,
      },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right',
        render: (u) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => openEdit(u)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={u.isActive ? 'Desactivar' : 'Activar'}>
              <IconButton size="small" onClick={() => toggleActive(u)}>
                {u.isActive ? <ToggleOnIcon fontSize="small" color="success" /> : <ToggleOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton size="small" color="error" onClick={() => askDelete(u)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [openEdit, toggleActive, askDelete],
  );

  return (
    <Box>
      <PageHeader
        title="Usuarios"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      {/* The list error comes from the hook and clears on the next reload.
          Action results are pop-up notices; a rejected deletion is explained
          inside its dialog. */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          label="Rol"
          size="small"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as AdminRoleFilter);
            setPage(1);
          }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos (administrativos)</MenuItem>
          <MenuItem value="ADMIN">Administrador</MenuItem>
          <MenuItem value="OPERATOR">Operador</MenuItem>
        </TextField>
        <TextField
          label="Buscar por nombre o email"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setAppliedSearch(search);
              setPage(1);
            }
          }}
          sx={{ minWidth: 260 }}
        />
        <Button
          onClick={() => {
            setAppliedSearch(search);
            setPage(1);
          }}
        >
          Buscar
        </Button>
      </Stack>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(u) => u.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        emptyMessage="No hay usuarios que coincidan con los filtros"
      />

      <UserFormDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          notify.success(editing ? 'Usuario actualizado' : 'Usuario creado');
          setFormOpen(false);
          void reload();
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar usuario"
        message={
          toDelete?.id === currentUser?.id
            ? `Vas a eliminar tu propia cuenta (${toDelete?.name}). Es una baja lógica: se cerrará tu sesión y no podrás volver a entrar con este usuario.`
            : `¿Seguro que querés eliminar a ${toDelete?.name}? Esta acción es una baja lógica y revoca sus sesiones.`
        }
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        error={actionError}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Box>
  );
}
