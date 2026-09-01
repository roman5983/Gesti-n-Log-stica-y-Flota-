import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import { documentsApi, type DocumentType, type DriverDocument } from '../../api/documents.api';
import type { Driver } from '../../api/drivers.api';
import { apiErrorMessage } from '../../api/axios';

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'LICENSE', label: 'Licencia' },
  { value: 'ART', label: 'ART' },
  { value: 'PSYCHOPHYSICAL', label: 'Psicofísico' },
];

interface Props {
  driver: Driver | null;
  canManage: boolean;
  onClose: () => void;
}

/** Admin management of a driver's documents (F-4): list, upload, view, delete. */
export function DriverDocumentsDialog({ driver, canManage, onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentType>('DNI');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load(driverId: number) {
    setLoading(true);
    setError(null);
    try {
      setDocs(await documentsApi.list(driverId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (driver) {
      setDocType('DNI');
      setExpiryDate('');
      void load(driver.id);
    }
  }, [driver]);

  async function handleUpload(file: File) {
    if (!driver || !expiryDate) {
      setError('Seleccioná el tipo y el vencimiento antes de subir el archivo');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await documentsApi.upload(driver.id, docType, expiryDate, file);
      await load(driver.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleDelete(documentId: number) {
    if (!driver) return;
    setError(null);
    try {
      await documentsApi.remove(driver.id, documentId);
      await load(driver.id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={driver !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Documentación de {driver?.name}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {canManage && (
          <>
            <Typography variant="subtitle2" gutterBottom>Subir documento</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <TextField select label="Tipo" size="small" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} sx={{ minWidth: 140 }}>
                {DOC_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
              <TextField label="Vencimiento" type="date" size="small" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              <Button variant="outlined" onClick={() => fileInput.current?.click()} disabled={uploading}>
                Elegir archivo
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
            <Typography variant="caption" color="text.secondary">
              Formatos: PDF, JPG, PNG (máx. 1 MB). Un documento activo por tipo.
            </Typography>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        <Typography variant="subtitle2" gutterBottom>Documentos cargados</Typography>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        ) : docs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Sin documentos cargados.</Typography>
        ) : (
          <List dense>
            {docs.map((d) => (
              <ListItem
                key={d.id}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <IconButton edge="end" onClick={() => documentsApi.open(d.driverId, d.id)} aria-label="Abrir">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                    {canManage && (
                      <IconButton edge="end" color="error" onClick={() => handleDelete(d.id)} aria-label="Eliminar">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                }
                disablePadding
              >
                <ListItemButton onClick={() => documentsApi.open(d.driverId, d.id)}>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{DOC_TYPES.find((t) => t.value === d.documentType)?.label ?? d.documentType}</span>
                        {d.expired && <Chip size="small" label="Vencido" color="error" />}
                      </Stack>
                    }
                    secondary={`Vence: ${new Date(d.expiryDate).toLocaleDateString('es-AR')} · ${d.fileName}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
