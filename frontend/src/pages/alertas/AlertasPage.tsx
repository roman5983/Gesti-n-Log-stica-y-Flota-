import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert as MuiAlert, Box, Button, IconButton, Paper, Snackbar, Tab, Tabs, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { alertsApi, type Alert, type AlertStatus } from '../../api/alerts.api';
import { apiErrorMessage } from '../../api/axios';
import { useAuth } from '../../auth/use-auth';

/** Where each alert's entity is managed, so "ir al origen" can jump there. */
function sourceLink(a: Alert): string | null {
  switch (a.entityType) {
    case 'VEHICLE':
      return `/vehiculos?highlight=${a.entityId}`;
    case 'DRIVER':
      return `/choferes?highlight=${a.entityId}`;
    case 'DRIVER_DOCUMENT':
      return a.linkedDriverId ? `/choferes?highlight=${a.linkedDriverId}` : null;
    default:
      return null;
  }
}

/** Human labels for the alert type codes (extensible taxonomy C-4). */
const ALERT_LABELS: Record<string, string> = {
  LICENSE_EXPIRING: 'Licencia por vencer',
  LICENSE_EXPIRED: 'Licencia vencida',
  DOCUMENT_EXPIRING: 'Documento por vencer',
  DOCUMENT_EXPIRED: 'Documento vencido',
  INSURANCE_EXPIRING: 'Seguro por vencer',
  INSURANCE_EXPIRED: 'Seguro vencido',
  MAINTENANCE_KM_EXCEEDED: 'Km de mantenimiento superado',
  VEHICLE_INACTIVE: 'Vehículo inactivo',
};

export function AlertasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState(0);
  const status: AlertStatus = tab === 0 ? 'PENDING' : 'RESOLVED';

  const fetchFn = useCallback(
    (params: PageParams) => alertsApi.list({ ...params, status }),
    [status],
  );
  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Alert>(fetchFn);

  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  async function handleEvaluate() {
    setEvaluating(true);
    setActionError(null);
    try {
      const r = await alertsApi.evaluate();
      setToast(`Evaluación completa: ${r.created} nuevas, ${r.autoResolved} auto-resueltas`);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setEvaluating(false);
    }
  }

  const [toResolve, setToResolve] = useState<Alert | null>(null);
  const [resolving, setResolving] = useState(false);

  async function confirmResolve() {
    if (!toResolve) return;
    setResolving(true);
    setActionError(null);
    try {
      await alertsApi.resolve(toResolve.id);
      setToResolve(null);
      await reload();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setResolving(false);
    }
  }

  const goToSource = useCallback(
    (a: Alert) => {
      const link = sourceLink(a);
      if (link) navigate(link);
    },
    [navigate],
  );

  const columns = useMemo<Column<Alert>[]>(
    () => [
      { key: 'type', label: 'Tipo', render: (a) => ALERT_LABELS[a.alertType] ?? a.alertType },
      { key: 'description', label: 'Descripción', render: (a) => a.description },
      { key: 'entity', label: 'Entidad', render: (a) => `${a.entityType} #${a.entityId}` },
      { key: 'raised', label: 'Fecha', render: (a) => new Date(a.raisedAt).toLocaleString('es-AR') },
      {
        key: 'actions',
        label: 'Acciones',
        align: 'right' as const,
        render: (a: Alert) => (
          <Tooltip title={sourceLink(a) ? 'Ir al origen' : 'Origen no disponible'}>
            <span>
              <IconButton size="small" disabled={!sourceLink(a)} onClick={() => goToSource(a)}>
                <LaunchIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
      ...(isAdmin && status === 'PENDING'
        ? [
            {
              key: 'resolve',
              label: '',
              align: 'right' as const,
              render: (a: Alert) => (
                <Tooltip title="Marcar como resuelta">
                  <IconButton size="small" color="success" onClick={() => setToResolve(a)}>
                    <DoneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ),
            },
          ]
        : []),
    ],
    [isAdmin, status, goToSource],
  );

  return (
    <Box>
      <PageHeader
        title="Alertas"
        action={
          isAdmin ? (
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleEvaluate} disabled={evaluating}>
              Evaluar alertas
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <MuiAlert severity="error" sx={{ mb: 2 }}>{error}</MuiAlert>
      ) : actionError ? (
        <MuiAlert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</MuiAlert>
      ) : null}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(1); }}>
          <Tab label="Pendientes" />
          <Tab label="Resueltas" />
        </Tabs>
      </Paper>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(a) => a.id}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        emptyMessage={status === 'PENDING' ? 'No hay alertas pendientes' : 'No hay alertas resueltas'}
      />

      <Snackbar open={toast !== null} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} />

      <ConfirmDialog
        open={toResolve !== null}
        title="Resolver alerta"
        message={toResolve ? `¿Marcar como resuelta la alerta "${ALERT_LABELS[toResolve.alertType] ?? toResolve.alertType}"?` : ''}
        confirmLabel="Resolver"
        loading={resolving}
        onConfirm={confirmResolve}
        onCancel={() => setToResolve(null)}
      />
    </Box>
  );
}
