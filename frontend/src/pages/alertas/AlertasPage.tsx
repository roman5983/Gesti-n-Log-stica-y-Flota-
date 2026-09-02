import { useCallback, useMemo, useState } from 'react';
import { Alert as MuiAlert, Box, Button, IconButton, Paper, Snackbar, Tab, Tabs, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { usePaginatedList, type PageParams } from '../../hooks/usePaginatedList';
import { alertsApi, type Alert, type AlertStatus } from '../../api/alerts.api';
import { apiErrorMessage } from '../../api/axios';
import { useAuth } from '../../auth/use-auth';

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

  const handleResolve = useCallback(
    async (a: Alert) => {
      setActionError(null);
      try {
        await alertsApi.resolve(a.id);
        await reload();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [reload],
  );

  const columns = useMemo<Column<Alert>[]>(
    () => [
      { key: 'type', label: 'Tipo', render: (a) => ALERT_LABELS[a.alertType] ?? a.alertType },
      { key: 'description', label: 'Descripción', render: (a) => a.description },
      { key: 'entity', label: 'Entidad', render: (a) => `${a.entityType} #${a.entityId}` },
      { key: 'raised', label: 'Fecha', render: (a) => new Date(a.raisedAt).toLocaleString('es-AR') },
      ...(isAdmin && status === 'PENDING'
        ? [
            {
              key: 'actions',
              label: 'Acciones',
              align: 'right' as const,
              render: (a: Alert) => (
                <Tooltip title="Marcar como resuelta">
                  <IconButton size="small" color="success" onClick={() => handleResolve(a)}>
                    <DoneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ),
            },
          ]
        : []),
    ],
    [isAdmin, status, handleResolve],
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
    </Box>
  );
}
