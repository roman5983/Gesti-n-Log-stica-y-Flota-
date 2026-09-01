import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Typography,
} from '@mui/material';
import { StatusChip } from '../../components/StatusChip';
import { RouteMap } from '../../components/RouteMap';
import type { Trip } from '../../api/trips.api';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={6}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  );
}

/** Read-only trip detail. The Google Maps route view is a later integration. */
export function TripDetailDialog({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  return (
    <Dialog open={trip !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Viaje VJ-{trip ? String(trip.id).padStart(5, '0') : ''} <StatusChip status={trip?.status ?? ''} />
      </DialogTitle>
      <DialogContent dividers>
        {trip && (
          <Grid container spacing={2}>
            <Field label="Origen" value={trip.origin} />
            <Field label="Destino" value={trip.destination} />
            <Field label="Salida" value={new Date(trip.departureAt).toLocaleString('es-AR')} />
            <Field
              label="Distancia estimada"
              value={trip.estimatedDistanceKm ? `${trip.estimatedDistanceKm} km` : '—'}
            />
            <Field label="Chofer" value={trip.driver ? `${trip.driver.name} (DNI ${trip.driver.dni})` : '—'} />
            <Field
              label="Vehículo"
              value={trip.vehicle ? `${trip.vehicle.licensePlate} — ${trip.vehicle.model}` : '—'}
            />
            <Field label="Km salida" value={trip.departureKm?.toLocaleString('es-AR') ?? '—'} />
            <Field label="Km llegada" value={trip.arrivalKm?.toLocaleString('es-AR') ?? '—'} />
            <Field label="Operador" value={trip.operator.name} />
            <Field
              label="Finalizado"
              value={trip.finishedAt ? new Date(trip.finishedAt).toLocaleString('es-AR') : '—'}
            />
            {trip.notes && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Observaciones
                </Typography>
                <Typography variant="body2">{trip.notes}</Typography>
              </Grid>
            )}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Recorrido
              </Typography>
              <RouteMap origin={trip.origin} destination={trip.destination} />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
