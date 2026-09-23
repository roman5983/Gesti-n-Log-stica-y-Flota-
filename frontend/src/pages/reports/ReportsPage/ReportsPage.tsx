import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { KpiCard } from '@/components/KpiCard/KpiCard';
import { DateRangeFilter } from '@/components/DateRangeFilter/DateRangeFilter';
import { reportsApi, type TripReport } from '@/api/reports.api';
import { apiErrorMessage } from '@/api/axios';
import dayjs from 'dayjs';
import { MAX_REPORT_DAYS } from './ReportsPage.const';

/** Trip report over a selectable period (A-11 / P-AD-5), Admin-only. */
export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<TripReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooLong = Boolean(dateFrom && dateTo) && dayjs(dateTo).diff(dayjs(dateFrom), 'day') >= MAX_REPORT_DAYS;
  // Flagged on the "Hasta" field too; here it just keeps the button off.
  const inverted = Boolean(dateFrom && dateTo) && dateTo < dateFrom;

  async function generate() {
    if (!dateFrom || !dateTo || tooLong || inverted) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await reportsApi.trips(dateFrom, dateTo));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <PageHeader title="Reportes" />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }} justifyContent="space-between">
            <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />
            <Button variant="contained" onClick={generate} disabled={loading || !dateFrom || !dateTo || tooLong || inverted}>
              Generar informe
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* A disabled button always says why (heuristic: help users recognize
          why an action is not available). */}
      {(!dateFrom || !dateTo) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Elegí el período (Desde y Hasta) o un atajo como "Este mes" para generar el informe.
        </Alert>
      )}
      {inverted && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          La fecha "Desde" es posterior a "Hasta". Corregí el período para generar el informe.
        </Alert>
      )}
      {tooLong && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          El período no puede superar {MAX_REPORT_DAYS} días. Acortalo para generar el informe.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {report && !loading && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}><KpiCard label="Viajes finalizados" value={report.summary.completedTrips} /></Grid>
            <Grid item xs={6} md={3}><KpiCard label="Km totales" value={report.summary.totalKm.toLocaleString('es-AR')} /></Grid>
            <Grid item xs={6} md={3}><KpiCard label="Distancia promedio" value={`${report.summary.averageDistanceKm} km`} /></Grid>
            <Grid item xs={6} md={3}><KpiCard label="Mantenimientos" value={report.summary.maintenancesCompleted} /></Grid>
          </Grid>

          <ReportTable
            title="Por chofer"
            head={['Chofer', 'DNI', 'Viajes', 'Km']}
            rows={report.byDriver.map((d) => [d.name, d.dni, String(d.tripCount), d.totalKm.toLocaleString('es-AR')])}
          />
          <ReportTable
            title="Por vehículo"
            head={['Patente', 'Modelo', 'Viajes', 'Km']}
            rows={report.byVehicle.map((v) => [v.licensePlate, v.model, String(v.tripCount), v.totalKm.toLocaleString('es-AR')])}
          />
          <ReportTable
            title="Destinos más frecuentes"
            head={['Destino', 'Viajes']}
            rows={report.topDestinations.map((d) => [d.destination, String(d.tripCount)])}
          />
        </Stack>
      )}
    </Box>
  );
}

function ReportTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <TableContainer component={Card}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {head.map((h, i) => (
                <TableCell key={h} align={i >= head.length - 2 ? 'right' : 'left'}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={head.length} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  Sin datos en el período
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, ri) => (
                <TableRow key={ri}>
                  {r.map((c, ci) => (
                    <TableCell key={ci} align={ci >= r.length - 2 ? 'right' : 'left'}>{c}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
