import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable.types';
import { StatusChip } from '@/components/StatusChip/StatusChip';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter/DateRangeFilter';
import { SortControl } from '@/components/SortControl/SortControl';
import type { SortOrder } from '@/components/SortControl/SortControl.types';
import { useMaintenanceTypeOptions, useVehicleOptions } from '@/hooks/useFilterOptions';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { maintenancesApi, type Maintenance, type MaintenanceSortField } from '@/api/maintenances.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { CreateMaintenanceDialog } from '@/pages/maintenance/CreateMaintenanceDialog/CreateMaintenanceDialog';
import { MaintenanceDetailDialog } from '@/pages/maintenance/MaintenanceDetailDialog/MaintenanceDetailDialog';
import { formatLocalDate } from '@/utils/datetime';
import { SORT_OPTIONS } from './MaintenanceListTab.data';
import type { MaintenanceListTabProps } from './MaintenanceListTab.types';

/**
 * Scheduled (PENDING+IN_PROGRESS) or history (COMPLETED+CANCELLED) list of
 * maintenances, filterable by vehicle, type and period and sortable by any of
 * the fields in SORT_OPTIONS (also from the column headers).
 */
export function MaintenanceListTab({ view }: MaintenanceListTabProps) {
  const vehicles = useVehicleOptions();
  const types = useMaintenanceTypeOptions();
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [typeId, setTypeId] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // The history reads best by when the work ended; the schedule, by when it is due.
  const [sortBy, setSortBy] = useState<MaintenanceSortField>(view === 'history' ? 'completedAt' : 'scheduledAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchFn = useCallback(
    (params: PageParams) =>
      maintenancesApi.list({
        ...params,
        view,
        vehicleId: vehicleId || undefined,
        maintenanceTypeId: typeId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      }),
    [view, vehicleId, typeId, dateFrom, dateTo, sortBy, sortOrder],
  );
  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Maintenance>(fetchFn);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Maintenance | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Maintenance | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const notify = useNotify();

  async function confirmCancel() {
    if (!toCancel) return;
    setCancelling(true);
    setActionError(null);
    try {
      await maintenancesApi.cancel(toCancel.id);
      notify.success(`Mantenimiento de ${toCancel.vehicle.licensePlate} cancelado`);
      setToCancel(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  const transition = useCallback(
    async (m: Maintenance, action: 'start' | 'complete') => {
      try {
        await (action === 'start' ? maintenancesApi.start(m.id) : maintenancesApi.complete(m.id));
        notify.success(
          action === 'start'
            ? `Mantenimiento iniciado: ${m.vehicle.licensePlate} pasó a "En taller"`
            : `Mantenimiento de ${m.vehicle.licensePlate} completado: el vehículo vuelve a estar disponible`,
        );
        await reload();
      } catch (err) {
        // One-click action (no dialog): e.g. the vehicle is on a trip.
        notify.error(apiErrorMessage(err));
      }
    },
    [reload, notify],
  );

  const columns = useMemo<Column<Maintenance>[]>(
    () => [
      { key: 'vehicle', label: 'Vehículo', sortKey: 'vehicle', render: (m) => m.vehicle.licensePlate },
      { key: 'type', label: 'Tipo', sortKey: 'type', render: (m) => m.maintenanceType.name },
      { key: 'scheduled', label: 'Programado', sortKey: 'scheduledAt', render: (m) => formatLocalDate(m.scheduledAt) },
      ...(view === 'history'
        ? [
            {
              key: 'completed',
              label: 'Finalizado',
              sortKey: 'completedAt',
              render: (m: Maintenance) => (m.completedAt ? formatLocalDate(m.completedAt) : '—'),
            },
          ]
        : []),
      { key: 'km', label: 'Km', align: 'right', sortKey: 'km', render: (m) => m.km.toLocaleString('es-AR') },
      { key: 'status', label: 'Estado', render: (m) => <StatusChip status={m.status} /> },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right',
        render: (m) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Ver detalle">
              <IconButton size="small" onClick={() => setDetail(m)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {m.status === 'PENDING' && (
              <Tooltip title="Iniciar">
                <IconButton size="small" color="primary" onClick={() => transition(m, 'start')}>
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {m.status === 'IN_PROGRESS' && (
              <Tooltip title="Completar">
                <IconButton size="small" color="success" onClick={() => transition(m, 'complete')}>
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {(m.status === 'PENDING' || m.status === 'IN_PROGRESS') && (
              <Tooltip title="Cancelar mantenimiento">
                <IconButton size="small" onClick={() => setToCancel(m)}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [transition, view],
  );

  const setSort = (by: MaintenanceSortField, order: SortOrder) => {
    setSortBy(by);
    setSortOrder(order);
    setPage(1);
  };
  const hasFilters = vehicleId !== '' || typeId !== '' || dateFrom !== '' || dateTo !== '';

  // The detail dialog should reflect fresh data after an upload; find the
  // current version of the open maintenance in the reloaded rows.
  const openDetail = detail ? (items.find((m) => m.id === detail.id) ?? detail) : null;

  return (
    <Box>
      {view === 'scheduled' && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Registrar mantenimiento
          </Button>
        </Stack>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap" alignItems={{ md: 'flex-start' }}>
        <TextField
          select
          label="Vehículo"
          size="small"
          value={vehicleId}
          onChange={(e) => { setVehicleId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {vehicles.map((v) => (
            <MenuItem key={v.id} value={v.id}>{v.licensePlate} — {v.model}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Tipo de mantenimiento"
          size="small"
          value={typeId}
          onChange={(e) => { setTypeId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {types.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
        <SortControl options={SORT_OPTIONS} sortBy={sortBy} sortOrder={sortOrder} onChange={setSort} />
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(m) => m.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        sort={{ by: sortBy, order: sortOrder, onChange: (by, order) => setSort(by as MaintenanceSortField, order) }}
        emptyMessage={
          hasFilters
            ? 'No hay mantenimientos que coincidan con los filtros'
            : view === 'scheduled'
              ? 'No hay mantenimientos programados'
              : 'No hay mantenimientos finalizados ni cancelados'
        }
      />

      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar mantenimiento"
        message={
          toCancel?.status === 'IN_PROGRESS'
            ? `¿Cancelar el mantenimiento de ${toCancel.vehicle.licensePlate}? El vehículo vuelve a estar disponible y no se registra como realizado.`
            : `¿Cancelar el mantenimiento programado de ${toCancel?.vehicle.licensePlate}?`
        }
        confirmLabel="Cancelar mantenimiento"
        confirmColor="error"
        cancelLabel="Volver"
        loading={cancelling}
        error={actionError}
        onConfirm={confirmCancel}
        onCancel={() => { setToCancel(null); setActionError(null); }}
      />

      <CreateMaintenanceDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { notify.success('Mantenimiento registrado'); setCreateOpen(false); void reload(); }} />
      <MaintenanceDetailDialog maintenance={openDetail} onClose={() => setDetail(null)} onChanged={() => void reload()} />
    </Box>
  );
}
