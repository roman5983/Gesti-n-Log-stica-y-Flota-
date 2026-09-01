import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import FlagIcon from '@mui/icons-material/Flag';
import DeleteIcon from '@mui/icons-material/Delete';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusChip } from '../../components/StatusChip';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { tripsApi, type Trip, type TripStatus } from '../../api/trips.api';
import { apiErrorMessage } from '../../api/axios';
import { TripFormDialog } from './TripFormDialog';
import { AssignTripDialog } from './AssignTripDialog';
import { FinishTripDialog } from './FinishTripDialog';
import { TripDetailDialog } from './TripDetailDialog';

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: 'PENDING_ASSIGNMENT', label: 'Pendiente de asignación' },
  { value: 'IN_PROGRESS', label: 'En viaje' },
  { value: 'COMPLETED', label: 'Finalizado' },
];

export function ViajesPage() {
  const [statusFilter, setStatusFilter] = useState<TripStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      tripsApi.list({
        ...params,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [statusFilter, dateFrom, dateTo],
  );

  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Trip>(fetchFn);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [assignTrip, setAssignTrip] = useState<Trip | null>(null);
  const [finishTrip, setFinishTrip] = useState<Trip | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [toDelete, setToDelete] = useState<Trip | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await tripsApi.remove(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<Column<Trip>[]>(
    () => [
      { key: 'id', label: 'N°', render: (t) => `VJ-${String(t.id).padStart(5, '0')}` },
      { key: 'departure', label: 'Salida', render: (t) => new Date(t.departureAt).toLocaleString('es-AR') },
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
                <Tooltip title="Eliminar">
                  <IconButton size="small" color="error" onClick={() => setToDelete(t)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {t.status === 'IN_PROGRESS' && (
              <Tooltip title="Finalizar">
                <IconButton size="small" color="error" onClick={() => setFinishTrip(t)}>
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
      ) : actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
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
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          InputLabelProps={{ shrink: true }}
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
        emptyMessage="No hay viajes que coincidan con los filtros"
      />

      <TripFormDialog open={formOpen} trip={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); void reload(); }} />
      <AssignTripDialog open={assignTrip !== null} trip={assignTrip} onClose={() => setAssignTrip(null)} onSaved={() => { setAssignTrip(null); void reload(); }} />
      <FinishTripDialog open={finishTrip !== null} trip={finishTrip} onClose={() => setFinishTrip(null)} onSaved={() => { setFinishTrip(null); void reload(); }} />
      <TripDetailDialog trip={detailTrip} onClose={() => setDetailTrip(null)} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar viaje"
        message={`¿Eliminar el viaje a ${toDelete?.destination}? Solo se pueden eliminar viajes pendientes de asignación.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  );
}
