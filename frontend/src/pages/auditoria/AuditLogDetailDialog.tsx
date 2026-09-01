import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import type { AuditLog } from '../../api/audit-logs.api';

/** Renders a JSON snapshot as readable key/value lines, or a dash if empty. */
function Snapshot({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  if (typeof data !== 'object') {
    return <Typography variant="body2">{String(data)}</Typography>;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  return (
    <Box component="dl" sx={{ m: 0 }}>
      {entries.map(([key, value]) => (
        <Box key={key} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
            {key}
          </Typography>
          <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
            {formatValue(value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Per-row audit detail: shows the before/after snapshots (RN-7). */
export function AuditLogDetailDialog({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  return (
    <Dialog open={log !== null} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Detalle de auditoría</DialogTitle>
      <DialogContent dividers>
        {log && (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Info label="Fecha y hora" value={new Date(log.occurredAt).toLocaleString('es-AR')} />
              <Info label="Usuario" value={`${log.user.name} (${log.user.email})`} />
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">Acción</Typography>
                <Box><Chip label={log.action} size="small" /></Box>
              </Grid>
              <Info label="Entidad" value={`${log.entity}${log.entityId != null ? ` #${log.entityId}` : ''}`} />
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Antes</Typography>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50', minHeight: 80 }}>
                  <Snapshot data={log.previousData} />
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Después</Typography>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50', minHeight: 80 }}>
                  <Snapshot data={log.newData} />
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={6}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  );
}
