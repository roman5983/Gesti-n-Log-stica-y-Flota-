import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusChip } from '../../components/StatusChip';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { usersApi, ADMINISTRATIVE_ROLES, type User } from '../../api/users.api';
import { apiErrorMessage } from '../../api/axios';
import { UserFormDialog } from './UserFormDialog';

type AdminRoleFilter = 'ADMIN' | 'OPERATOR' | '';

export function UsuariosPage() {
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
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(user: User) {
    setEditing(user);
    setFormOpen(true);
  }

  async function toggleActive(user: User) {
    setActionError(null);
    try {
      await usersApi.setActive(user.id, !user.isActive);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await usersApi.remove(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (err) {
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
              <IconButton size="small" color="error" onClick={() => setToDelete(u)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
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

      {/* The list error comes from the hook and clears on the next reload, so
          it has no manual close; action errors are dismissable. */}
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

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
          setFormOpen(false);
          void reload();
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar usuario"
        message={`¿Seguro que querés eliminar a ${toDelete?.name}? Esta acción es una baja lógica y revoca sus sesiones.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  );
}
