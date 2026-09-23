import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert as MuiAlert, Box, Button, CircularProgress, IconButton, ListSubheader, MenuItem, Paper, Stack, Tab, TablePagination, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneIcon from '@mui/icons-material/Done';
import LaunchIcon from '@mui/icons-material/Launch';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DateRangeFilter } from '@/components/DateRangeFilter/DateRangeFilter';
import { SortControl } from '@/components/SortControl/SortControl';
import type { SortOrder } from '@/components/SortControl/SortControl.types';
import { useVehicleOptions } from '@/hooks/useFilterOptions';
import { usePaginatedList, type PageParams } from '@/hooks/usePaginatedList';
import { alertsApi, type Alert, type AlertSortField, type AlertStatus } from '@/api/alerts.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';
import { useAuth } from '@/hooks/useAuth';
import { AlertCard } from '@/pages/alerts/AlertCard/AlertCard';
import { alertLabel, alertPresentation } from '@/pages/alerts/AlertCard/AlertCard.helpers';
import { ALERT_TYPE_CODES, CATEGORY_LABELS } from '@/pages/alerts/AlertCard/AlertCard.data';
import type { AlertCategory } from '@/pages/alerts/AlertCard/AlertCard.types';
import { POLL_INTERVAL_MS } from './AlertsPage.const';
import { SORT_OPTIONS } from './AlertsPage.data';
import { sourceLink } from './AlertsPage.helpers';

/** Type filter entries grouped by category (ListSubheader rows between groups). */
function typeFilterItems() {
  const items: ReactElement[] = [];
  let lastCategory: AlertCategory | null = null;
  for (const code of ALERT_TYPE_CODES) {
    const { category } = alertPresentation(code);
    if (category !== lastCategory) {
      items.push(<ListSubheader key={`h-${category}`}>{CATEGORY_LABELS[category]}</ListSubheader>);
      lastCategory = category;
    }
    items.push(
      <MenuItem key={code} value={code}>
        {alertLabel(code)}
      </MenuItem>,
    );
  }
  return items;
}

export function AlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState(0);
  const status: AlertStatus = tab === 0 ? 'PENDING' : 'RESOLVED';
  const vehicles = useVehicleOptions();
  const [alertType, setAlertType] = useState('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<AlertSortField>('raisedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchFn = useCallback(
    (params: PageParams) =>
      alertsApi.list({
        ...params,
        status,
        alertType: alertType || undefined,
        vehicleId: vehicleId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      }),
    [status, alertType, vehicleId, dateFrom, dateTo, sortBy, sortOrder],
  );
  const { items, total, page, setPage, limit, setLimit, loading, error, reload } =
    usePaginatedList<Alert>(fetchFn);

  const [actionError, setActionError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const notify = useNotify();

  async function handleEvaluate() {
    setEvaluating(true);
    try {
      const r = await alertsApi.evaluate();
      notify.success(
        r.created === 0 && r.autoResolved === 0
          ? 'Evaluación completa: no hubo cambios'
          : `Evaluación completa: ${r.created} nuevas, ${r.autoResolved} resueltas automáticamente`,
      );
      await reload();
    } catch (err) {
      // e.g. 409 while the daily run is in progress.
      notify.error(apiErrorMessage(err));
    } finally {
      setEvaluating(false);
    }
  }

  // The server evaluates alerts once a day and after each start
  // (alerts.scheduler.ts); the page re-reads the list while it is visible so
  // alerts created by the job or by another admin show up.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload]);

  const [toResolve, setToResolve] = useState<Alert | null>(null);
  const [resolving, setResolving] = useState(false);

  async function confirmResolve() {
    if (!toResolve) return;
    setResolving(true);
    setActionError(null);
    try {
      await alertsApi.resolve(toResolve.id);
      notify.success(`Alerta "${alertLabel(toResolve.alertType)}" resuelta`);
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

  const hasFilters = alertType !== '' || vehicleId !== '' || dateFrom !== '' || dateTo !== '';

  function clearFilters() {
    setAlertType('');
    setVehicleId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  function cardActions(a: Alert) {
    const link = sourceLink(a);
    return (
      <>
        <Tooltip title={!isAdmin ? 'Solo los administradores pueden abrir el origen' : link ? 'Ir al origen' : 'Origen no disponible'}>
          <span>
            <IconButton size="small" aria-label="Ir al origen" disabled={!isAdmin || !link} onClick={() => goToSource(a)}>
              <LaunchIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {isAdmin && a.status === 'PENDING' && (
          <Tooltip title="Marcar como resuelta">
            <IconButton size="small" color="success" aria-label="Marcar como resuelta" onClick={() => setToResolve(a)}>
              <DoneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </>
    );
  }

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
      ) : null}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(1); }}>
          <Tab label="Pendientes" />
          <Tab label="Resueltas" />
        </Tabs>
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap" alignItems={{ md: 'flex-start' }}>
        <TextField
          select
          label="Tipo"
          size="small"
          value={alertType}
          onChange={(e) => { setAlertType(e.target.value); setPage(1); }}
          sx={{ minWidth: 230 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {typeFilterItems()}
        </TextField>
        <TextField
          select
          label="Vehículo"
          size="small"
          value={vehicleId}
          onChange={(e) => { setVehicleId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
          sx={{ minWidth: 200 }}
          helperText={vehicleId !== '' ? 'Solo alertas del vehículo (seguro, km, inactividad)' : undefined}
        >
          <MenuItem value="">Todos</MenuItem>
          {vehicles.map((v) => (
            <MenuItem key={v.id} value={v.id}>{v.licensePlate} — {v.model}</MenuItem>
          ))}
        </TextField>
        <SortControl
          options={SORT_OPTIONS}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onChange={(by, order) => { setSortBy(by); setSortOrder(order); setPage(1); }}
        />
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); setPage(1); }}
        />
      </Stack>

      {loading && items.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : items.length === 0 ? (
        <Paper sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {hasFilters
              ? 'No hay alertas que coincidan con los filtros'
              : status === 'PENDING'
                ? 'No hay alertas pendientes'
                : 'No hay alertas resueltas'}
          </Typography>
          {hasFilters && (
            <Button sx={{ mt: 1 }} onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </Paper>
      ) : (
        <Stack spacing={1.5} aria-busy={loading} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}>
          {items.map((a) => (
            <AlertCard key={a.id} alert={a} actions={cardActions(a)} />
          ))}
        </Stack>
      )}

      {total > 0 && (
        <TablePagination
          component="div"
          count={total}
          page={page - 1}
          onPageChange={(_e, p) => setPage(p + 1)}
          rowsPerPage={limit}
          onRowsPerPageChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Alertas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      )}

      <ConfirmDialog
        open={toResolve !== null}
        title="Resolver alerta"
        message={toResolve ? `¿Marcar como resuelta la alerta "${alertLabel(toResolve.alertType)}"? ${toResolve.description}` : ''}
        confirmLabel="Resolver"
        loading={resolving}
        error={actionError}
        onConfirm={confirmResolve}
        onCancel={() => { setToResolve(null); setActionError(null); }}
      />
    </Box>
  );
}
