import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { SearchField } from '@/components/SearchField/SearchField';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { vehiclesApi, type Vehicle, type VehicleStatus } from '@/api/vehicles.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { useAuth } from '@/hooks/useAuth';
import { VehicleFormDialog } from '@/pages/vehicles/VehicleFormDialog/VehicleFormDialog';
import { formatDateOnly } from '@/utils/datetime';
import { STATUS_OPTIONS } from './VehiclesPage.data';
import { statusFromParams } from './VehiclesPage.helpers';

export function VehiclesPage() {
  const { user } = useAuth();
  // Vehicle mutations are ADMIN-only in the backend; the Operator has read
  // access here (shared route), so hide the actions that would 403.
  const canManage = user?.role === 'ADMIN';
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | ''>(() =>
    statusFromParams(searchParams.get('estado')),
  );
  const [search, setSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      vehiclesApi.list({
        ...params,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
    [statusFilter, search],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Vehicle>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  // Deep link from Alertas ("ir al origen"): open the vehicle straight away.
  const highlight = searchParams.get('highlight');
  useEffect(() => {
    if (!highlight || !canManage) return;
    vehiclesApi
      .getById(Number(highlight))
      .then((v) => { setEditing(v); setFormOpen(true); })
      .catch(() => notify.warning('No se encontró el vehículo indicado. Puede haber sido eliminado.'));
  }, [highlight, canManage, notify]);

  const toggleActive = useCallback(
    async (v: Vehicle) => {
      const activating = v.status === 'INACTIVE';
      try {
        await vehiclesApi.setActive(v.id, activating);
        notify.success(`Vehículo ${v.licensePlate} ${activating ? 'activado' : 'desactivado'}`);
        await reload();
      } catch (err) {
        // One-click action (no dialog): the reason goes in a pop-up notice.
        notify.error(apiErrorMessage(err));
      }
    },
    [reload, notify],
  );

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await vehiclesApi.remove(toDelete.id);
      notify.success(`Vehículo ${toDelete.licensePlate} eliminado`);
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
          v.insuranceExpiryDate ? formatDateOnly(v.insuranceExpiryDate) : '—',
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
        <SearchField
          placeholder="Patente o modelo"
          value={search}
          onSearch={(text) => { setSearch(text); setPage(1); }}
        />
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
        onSaved={() => { notify.success(editing ? 'Vehículo actualizado' : 'Vehículo creado'); setFormOpen(false); void reload(); }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar vehículo"
        message={`¿Seguro que querés eliminar el vehículo ${toDelete?.licensePlate}? Es una baja lógica.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        error={actionError}
        onConfirm={confirmDelete}
        onCancel={() => { setToDelete(null); setActionError(null); }}
      />
    </Box>
  );
}
