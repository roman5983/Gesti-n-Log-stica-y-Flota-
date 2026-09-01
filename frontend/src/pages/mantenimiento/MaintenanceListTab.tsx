import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, Stack, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusChip } from '../../components/StatusChip';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { maintenancesApi, type Maintenance } from '../../api/maintenances.api';
import { apiErrorMessage } from '../../api/axios';
import { CreateMaintenanceDialog } from './CreateMaintenanceDialog';
import { MaintenanceDetailDialog } from './MaintenanceDetailDialog';

/** Scheduled (PENDING+IN_PROGRESS) or history (COMPLETED) list of maintenances. */
export function MaintenanceListTab({ view }: { view: 'scheduled' | 'history' }) {
  const fetchFn = useCallback(
    (params: PageParams) => maintenancesApi.list({ ...params, view }),
    [view],
  );
  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Maintenance>(fetchFn);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Maintenance | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function transition(m: Maintenance, action: 'start' | 'complete') {
    setActionError(null);
    try {
      await (action === 'start' ? maintenancesApi.start(m.id) : maintenancesApi.complete(m.id));
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }

  const columns = useMemo<Column<Maintenance>[]>(
    () => [
      { key: 'vehicle', label: 'Vehículo', render: (m) => m.vehicle.licensePlate },
      { key: 'type', label: 'Tipo', render: (m) => m.maintenanceType.name },
      { key: 'scheduled', label: 'Programado', render: (m) => new Date(m.scheduledAt).toLocaleDateString('es-AR') },
      { key: 'km', label: 'Km', align: 'right', render: (m) => m.km.toLocaleString('es-AR') },
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
          </Stack>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
      ) : null}

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
        emptyMessage={view === 'scheduled' ? 'No hay mantenimientos programados' : 'No hay mantenimientos finalizados'}
      />

      <CreateMaintenanceDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); void reload(); }} />
      <MaintenanceDetailDialog maintenance={openDetail} onClose={() => setDetail(null)} onChanged={() => void reload()} />
    </Box>
  );
}
