import { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, CircularProgress, Grid, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { dashboardApi, type DashboardMetrics } from '../../api/dashboard.api';
import { apiErrorMessage } from '../../api/axios';
import { useAuth } from '../../auth/use-auth';

export function DashboardPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await dashboardApi.metrics();
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!metrics) return null;

  const isAdmin = user?.role === 'ADMIN';

  return (
    <Box>
      <PageHeader title="Dashboard" />

      {/* 4 KPI cards (P-OP-1 / P-AD-1) */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Viajes en viaje" value={metrics.trips.inProgress} icon={<LocalShippingIcon fontSize="inherit" />} color="info.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Pendientes de asignación" value={metrics.trips.pendingAssignment} icon={<PendingActionsIcon fontSize="inherit" />} color="warning.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Vehículos disponibles" value={metrics.fleet.available} icon={<DirectionsCarIcon fontSize="inherit" />} color="success.main" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Alertas activas" value={metrics.alerts.pending} icon={<NotificationsActiveIcon fontSize="inherit" />} color="error.main" />
        </Grid>
      </Grid>

      {/* Admin-only totals row (P-AD-1) */}
      {isAdmin && (
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={6} md={3}>
            <KpiCard label="Vehículos totales" value={metrics.fleet.total} />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Choferes activos" value={metrics.drivers.active} />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Mantenimientos pendientes" value={metrics.maintenances.pending} />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Usuarios del sistema" value={metrics.users.total} />
          </Grid>
        </Grid>
      )}

      {/* Trips per month chart */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Viajes por mes
          </Typography>
          <Box sx={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.tripsPerMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" name="Viajes" fill="#1e88e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
