import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { reportsApi, type TripReport } from '../../api/reports.api';
import { apiErrorMessage } from '../../api/axios';

/** Trip report over a selectable period (A-11 / P-AD-5), Admin-only. */
export function ReportesPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<TripReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!dateFrom || !dateTo) return;
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
            <TextField label="Desde" type="date" size="small" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Hasta" type="date" size="small" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="contained" onClick={generate} disabled={loading || !dateFrom || !dateTo}>
              Generar informe
            </Button>
          </Stack>
        </CardContent>
      </Card>

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
