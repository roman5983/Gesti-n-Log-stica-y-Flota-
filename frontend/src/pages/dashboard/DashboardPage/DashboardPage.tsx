import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, CircularProgress, Grid, Typography, alpha, useTheme } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import GarageIcon from '@mui/icons-material/Garage';
import BadgeIcon from '@mui/icons-material/Badge';
import BuildIcon from '@mui/icons-material/Build';
import PeopleIcon from '@mui/icons-material/People';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { KpiCard } from '@/components/KpiCard/KpiCard';
import { dashboardApi, type DashboardMetrics } from '@/api/dashboard.api';
import { apiErrorMessage } from '@/api/axios';
import { useAuth } from '@/hooks/useAuth';
import { barColorsFor } from './DashboardPage.helpers';

export function DashboardPage() {
  const { user } = useAuth();
  const theme = useTheme();
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

  // One color per bar, from the chart scale of the design system: the busiest
  // month is the lightest tone, the quietest the darkest (both ends keep
  // ≥ 3:1 over the card). Recomputed when the data or the color mode changes.
  const barColors = useMemo(
    () => barColorsFor(metrics?.tripsPerMonth ?? [], theme.palette.tokens.chart),
    [metrics, theme],
  );

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
          <KpiCard label="Viajes en viaje" value={metrics.trips.inProgress} icon={<LocalShippingIcon fontSize="inherit" />} tone="info" to="/viajes?estado=IN_PROGRESS" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Pendientes de asignación" value={metrics.trips.pendingAssignment} icon={<PendingActionsIcon fontSize="inherit" />} tone="warning" to="/viajes?estado=PENDING_ASSIGNMENT" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Vehículos disponibles" value={metrics.fleet.available} icon={<DirectionsCarIcon fontSize="inherit" />} tone="success" to="/vehiculos?estado=AVAILABLE" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Alertas activas" value={metrics.alerts.pending} icon={<NotificationsActiveIcon fontSize="inherit" />} tone="error" to="/alertas" />
        </Grid>
      </Grid>

      {/* Admin-only totals row (P-AD-1) */}
      {isAdmin && (
        <Grid container spacing={3} sx={{ mt: 0 }}>
          <Grid item xs={6} md={3}>
            <KpiCard label="Vehículos totales" value={metrics.fleet.total} icon={<GarageIcon fontSize="inherit" />} to="/vehiculos" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Choferes activos" value={metrics.drivers.active} icon={<BadgeIcon fontSize="inherit" />} to="/choferes" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Mantenimientos pendientes" value={metrics.maintenances.pending} icon={<BuildIcon fontSize="inherit" />} to="/mantenimiento" />
          </Grid>
          <Grid item xs={6} md={3}>
            <KpiCard label="Usuarios del sistema" value={metrics.users.total} icon={<PeopleIcon fontSize="inherit" />} to="/usuarios" />
          </Grid>
        </Grid>
      )}

      {/* Trips per month chart */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">Viajes por mes</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cuanto más claro el tono, más viajes en el mes.
          </Typography>
          <Box sx={{ height: 320 }}>
            {/* Recharts renders raw SVG and knows nothing about the MUI theme,
                so grid, axes, tooltip and bars are fed from the palette by hand
                — otherwise the chart stays light-themed over a dark page. */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.tripsPerMonth} margin={{ top: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis
                  dataKey="month"
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke={theme.palette.text.secondary}
                  tick={{ fill: theme.palette.text.secondary }}
                />
                <RechartsTooltip
                  cursor={{ fill: alpha(theme.palette.text.primary, 0.06) }}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                    color: theme.palette.text.primary,
                  }}
                  itemStyle={{ color: theme.palette.text.primary }}
                  labelStyle={{ color: theme.palette.text.secondary }}
                />
                <Bar dataKey="count" name="Viajes" radius={[4, 4, 0, 0]}>
                  {metrics.tripsPerMonth.map((m, i) => (
                    <Cell key={m.month} fill={barColors[i]} />
                  ))}
                  {/* The exact value on top of each bar: the tone is a visual
                      aid, never the only way to read the data. */}
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill={theme.palette.text.primary}
                    fontSize={12}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
