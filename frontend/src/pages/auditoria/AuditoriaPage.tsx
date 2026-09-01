import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, IconButton, MenuItem, Stack, TextField, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { auditLogsApi, type AuditLog } from '../../api/audit-logs.api';
import { AuditLogDetailDialog } from './AuditLogDetailDialog';

const ENTITIES = ['USER', 'DRIVER', 'VEHICLE', 'MAINTENANCE_TYPE', 'MAINTENANCE', 'DRIVER_DOCUMENT', 'TRIP', 'ALERT'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'ASSIGN', 'FINISH', 'RESOLVE', 'VIEW_CREDENTIALS'];

/** Read-only audit trail with filters (RN-7 / P-AD-3), Admin-only. */
export function AuditoriaPage() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchFn = useCallback(
    (params: PageParams) =>
      auditLogsApi.list({
        ...params,
        entity: entity || undefined,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [entity, action, dateFrom, dateTo],
  );
  const { items, total, page, setPage, limit, setLimit, loading, error } =
    usePaginatedList<AuditLog>(fetchFn);

  const [detail, setDetail] = useState<AuditLog | null>(null);

  const columns = useMemo<Column<AuditLog>[]>(
    () => [
      { key: 'date', label: 'Fecha y hora', render: (l) => new Date(l.occurredAt).toLocaleString('es-AR') },
      { key: 'user', label: 'Usuario', render: (l) => l.user.name },
      { key: 'action', label: 'Acción', render: (l) => l.action },
      { key: 'entity', label: 'Entidad', render: (l) => `${l.entity}${l.entityId != null ? ` #${l.entityId}` : ''}` },
      {
        key: 'actions',
        label: 'Detalle',
        align: 'right',
        render: (l) => (
          <Tooltip title="Ver antes/después">
            <IconButton size="small" onClick={() => setDetail(l)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  return (
    <Box>
      <PageHeader title="Auditoría" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField select label="Entidad" size="small" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} sx={{ minWidth: 180 }}>
          <MenuItem value="">Todas</MenuItem>
          {ENTITIES.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
        </TextField>
        <TextField select label="Acción" size="small" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} sx={{ minWidth: 160 }}>
          <MenuItem value="">Todas</MenuItem>
          {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField label="Desde" type="date" size="small" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
        <TextField label="Hasta" type="date" size="small" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} InputLabelProps={{ shrink: true }} />
      </Stack>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(l) => l.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage="No hay registros de auditoría para los filtros"
      />

      <AuditLogDetailDialog log={detail} onClose={() => setDetail(null)} />
    </Box>
  );
}
