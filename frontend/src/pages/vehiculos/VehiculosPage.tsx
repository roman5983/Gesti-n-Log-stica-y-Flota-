import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
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
import { vehiclesApi, type Vehicle, type VehicleStatus } from '../../api/vehicles.api';
import { apiErrorMessage } from '../../api/axios';
import { useAuth } from '../../auth/use-auth';
import { VehicleFormDialog } from './VehicleFormDialog';

const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'IN_WORKSHOP', label: 'En taller' },
  { value: 'ON_TRIP', label: 'En viaje' },
];

/** Reads an optional `?estado=` param so dashboard shortcuts can preset the filter. */
function statusFromParams(value: string | null): VehicleStatus | '' {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as VehicleStatus) : '';
}

export function VehiculosPage() {
  const { user } = useAuth();
  // Vehicle mutations are ADMIN-only in the backend; the Operator has read
  // access here (shared route), so hide the actions that would 403.
  const canManage = user?.role === 'ADMIN';
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | ''>(() =>
    statusFromParams(searchParams.get('estado')),
  );
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      vehiclesApi.list({
        ...params,
        status: statusFilter || undefined,
        search: appliedSearch || undefined,
      }),
    [statusFilter, appliedSearch],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Vehicle>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleActive = useCallback(
    async (v: Vehicle) => {
      setActionError(null);
      try {
        await vehiclesApi.setActive(v.id, v.status === 'INACTIVE');
        await reload();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [reload],
  );

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await vehiclesApi.remove(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<Column<Vehicle>[]>(
    () => [
      { key: 'plate', label: 'Patente', render: (v) => v.licensePlate },
      { key: 'model', label: 'Modelo', render: (v) => v.model },
      { key: 'year', label: 'Año', render: (v) => v.year },
      { key: 'km', label: 'Km acumulado', align: 'right', render: (v) => v.accumulatedKm.toLocaleString('es-AR') },
      { key: 'status', label: 'Estado', render: (v) => <StatusChip status={v.status} /> },
      {
        key: 'insurance',
        label: 'Seguro',
        render: (v) =>
          v.insuranceExpiryDate
            ? new Date(v.insuranceExpiryDate).toLocaleDateString('es-AR')
            : '—',
      },
      ...(canManage
        ? [
            {
              key: 'actions',
              label: 'Acciones',
              align: 'right' as const,
              render: (v: Vehicle) => (
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => { setEditing(v); setFormOpen(true); }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {v.status !== 'ON_TRIP' && (
                    <Tooltip title={v.status === 'INACTIVE' ? 'Activar' : 'Desactivar'}>
                      <IconButton size="small" onClick={() => toggleActive(v)}>
                        {v.status === 'INACTIVE' ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" color="success" />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Eliminar">
                    <IconButton size="small" color="error" onClick={() => setToDelete(v)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ),
            },
          ]
        : []),
    ],
    [canManage, toggleActive],
  );

  return (
    <Box>
      <PageHeader
        title="Vehículos"
        action={
          canManage ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Nuevo vehículo
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          label="Estado"
          size="small"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as VehicleStatus | ''); setPage(1); }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Buscar por patente o modelo"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setPage(1); } }}
          sx={{ minWidth: 260 }}
        />
        <Button onClick={() => { setAppliedSearch(search); setPage(1); }}>Buscar</Button>
      </Stack>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(v) => v.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage="No hay vehículos que coincidan con los filtros"
      />

      <VehicleFormDialog
        open={formOpen}
        vehicle={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar vehículo"
        message={`¿Seguro que querés eliminar el vehículo ${toDelete?.licensePlate}? Es una baja lógica.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  );
}
