import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { StatusChip } from '../../components/StatusChip';
import { maintenancesApi, type Maintenance } from '../../api/maintenances.api';
import { apiErrorMessage } from '../../api/axios';

interface Props {
  maintenance: Maintenance | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Maintenance detail with attachments: upload (F-9) and open (append-only). */
export function MaintenanceDetailDialog({ maintenance, onClose, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    if (!maintenance) return;
    setError(null);
    setUploading(true);
    try {
      await maintenancesApi.addAttachment(maintenance.id, file);
      onChanged(); // reload list (and this dialog's data via parent)
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleOpen(attachmentId: number) {
    if (!maintenance) return;
    try {
      await maintenancesApi.openAttachment(maintenance.id, attachmentId);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={maintenance !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Mantenimiento #{maintenance?.id} <StatusChip status={maintenance?.status ?? ''} />
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {maintenance && (
          <>
            <Grid container spacing={2}>
              <Detail label="Vehículo" value={`${maintenance.vehicle.licensePlate} — ${maintenance.vehicle.model}`} />
              <Detail label="Tipo" value={maintenance.maintenanceType.name} />
              <Detail label="Programado" value={new Date(maintenance.scheduledAt).toLocaleString('es-AR')} />
              <Detail label="Kilometraje" value={maintenance.km.toLocaleString('es-AR')} />
              <Detail label="Próximo (km)" value={maintenance.nextMaintenanceKm?.toLocaleString('es-AR') ?? '—'} />
              <Detail label="Finalizado" value={maintenance.completedAt ? new Date(maintenance.completedAt).toLocaleString('es-AR') : '—'} />
              {maintenance.notes && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Observaciones</Typography>
                  <Typography variant="body2">{maintenance.notes}</Typography>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">Comprobantes</Typography>
              <Button
                size="small"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                Subir
              </Button>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
            </Stack>

            {maintenance.attachments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin comprobantes. Formatos: PDF, JPG, PNG (máx. 1 MB).
              </Typography>
            ) : (
              <List dense>
                {maintenance.attachments.map((a) => (
                  <ListItem
                    key={a.id}
                    disablePadding
                    secondaryAction={
                      <IconButton edge="end" onClick={() => handleOpen(a.id)} aria-label="Abrir">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemButton onClick={() => handleOpen(a.id)}>
                      <ListItemText
                        primary={a.fileName}
                        secondary={`${(a.fileSize / 1024).toFixed(0)} KB · ${new Date(a.uploadedAt).toLocaleDateString('es-AR')}`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={6}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  );
}
