import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import FlagIcon from '@mui/icons-material/Flag';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable.types';
import { StatusChip } from '@/components/StatusChip/StatusChip';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter/DateRangeFilter';
import { SearchField } from '@/components/SearchField/SearchField';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { tripsApi, type Trip, type TripStatus } from '@/api/trips.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { TripFormDialog } from '@/pages/trips/TripFormDialog/TripFormDialog';
import { AssignTripDialog } from '@/pages/trips/AssignTripDialog/AssignTripDialog';
import { FinishTripDialog } from '@/pages/trips/FinishTripDialog/FinishTripDialog';
import { TripDetailDialog } from '@/pages/trips/TripDetailDialog/TripDetailDialog';
import { formatDateTime } from '@/utils/datetime';
import { STATUS_OPTIONS } from './TripsPage.data';
import { statusFromParams } from './TripsPage.helpers';

export function TripsPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<TripStatus | ''>(() =>
    statusFromParams(searchParams.get('estado')),
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      tripsApi.list({
        ...params,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      }),
    [statusFilter, dateFrom, dateTo, search],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Trip>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [assignTrip, setAssignTrip] = useState<Trip | null>(null);
  const [finishTrip, setFinishTrip] = useState<Trip | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [toDelete, setToDelete] = useState<Trip | null>(null);
  const [toCancel, setToCancel] = useState<Trip | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  // Deep link from Alertas ("ir al origen"): open the assign dialog straight away.
  const highlight = searchParams.get('highlight');
  useEffect(() => {
    if (!highlight) return;
    tripsApi
      .getById(Number(highlight))
      .then((t) => setAssignTrip(t))
      .catch(() => notify.warning('No se encontró el viaje indicado. Puede haber sido eliminado.'));
  }, [highlight, notify]);

  // Confirmed actions: success → close + notice; rejected → the dialog stays
  // open and shows the reason where the user acted (same rule in every list).
  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await tripsApi.remove(toDelete.id);
      notify.success(`Viaje a ${toDelete.destination} eliminado`);
      setToDelete(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!toCancel) return;
    setBusy(true);
    setActionError(null);
    try {
      await tripsApi.cancel(toCancel.id);
      notify.success(`Viaje a ${toCancel.destination} cancelado`);
      setToCancel(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function closeConfirm() {
    setToCancel(null);
    setToDelete(null);
    setActionError(null);
  }

  const columns = useMemo<Column<Trip>[]>(
    () => [
      { key: 'id', label: 'N°', render: (t) => `VJ-${String(t.id).padStart(5, '0')}` },
      { key: 'departure', label: 'Salida', render: (t) => formatDateTime(t.departureAt) },
      { key: 'destination', label: 'Destino', render: (t) => t.destination },
      { key: 'driver', label: 'Chofer', render: (t) => t.driver?.name ?? '—' },
      { key: 'vehicle', label: 'Vehículo', render: (t) => t.vehicle?.licensePlate ?? '—' },
      { key: 'status', label: 'Estado', render: (t) => <StatusChip status={t.status} /> },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right',
        render: (t) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Ver detalle">
              <IconButton size="small" onClick={() => setDetailTrip(t)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {t.status === 'PENDING_ASSIGNMENT' && (
              <>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => { setEditing(t); setFormOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Asignar">
                  <IconButton size="small" color="primary" onClick={() => setAssignTrip(t)}>
                    <AssignmentIndIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancelar viaje">
                  <IconButton size="small" onClick={() => setToCancel(t)}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" color="error" onClick={() => setToDelete(t)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {t.status === 'IN_PROGRESS' && (
              <Tooltip title="Finalizar">
                <IconButton size="small" color="primary" onClick={() => setFinishTrip(t)}>
                  <FlagIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [],
  );

  return (
    <Box>
      <PageHeader
        title="Viajes"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Crear viaje
          </Button>
        }
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <SearchField
          label="Buscar"
          placeholder="Chofer o destino"
          value={search}
          onSearch={(text) => { setSearch(text); setPage(1); }}
        />
        <TextField
          select
          label="Estado"
          size="small"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as TripStatus | ''); setPage(1); }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </Stack>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(t) => t.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage={
          search
            ? `No hay viajes con chofer o destino que contenga "${search}"`
            : 'No hay viajes que coincidan con los filtros'
        }
      />

      <TripFormDialog
        open={formOpen}
        trip={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { notify.success(editing ? 'Viaje actualizado' : 'Viaje creado'); setFormOpen(false); void reload(); }}
      />
      <AssignTripDialog
        open={assignTrip !== null}
        trip={assignTrip}
        onClose={() => setAssignTrip(null)}
        onSaved={() => { notify.success(`Viaje a ${assignTrip?.destination ?? ''} asignado`); setAssignTrip(null); void reload(); }}
      />
      <FinishTripDialog
        open={finishTrip !== null}
        trip={finishTrip}
        onClose={() => setFinishTrip(null)}
        onSaved={() => { notify.success(`Viaje a ${finishTrip?.destination ?? ''} finalizado`); setFinishTrip(null); void reload(); }}
      />
      <TripDetailDialog trip={detailTrip} onClose={() => setDetailTrip(null)} />

      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar viaje"
        message={`¿Cancelar el viaje a ${toCancel?.destination}? Solo se pueden cancelar viajes pendientes de asignación. Queda registrado como cancelado.`}
        confirmLabel="Cancelar viaje"
        confirmColor="error"
        cancelLabel="Volver"
        loading={busy}
        error={actionError}
        onConfirm={confirmCancel}
        onCancel={closeConfirm}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar viaje"
        message={`¿Eliminar el viaje a ${toDelete?.destination}? Solo se pueden eliminar viajes pendientes de asignación.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        error={actionError}
        onConfirm={confirmDelete}
        onCancel={closeConfirm}
      />
    </Box>
  );
}
