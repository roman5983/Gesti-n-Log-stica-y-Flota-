import { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '../../components/PageHeader';
import { documentsApi, type DocumentType, type DriverDocument } from '../../api/documents.api';
import { apiErrorMessage } from '../../api/axios';
import { useAuth } from '../../auth/use-auth';

const DOC_LABELS: Record<DocumentType, string> = {
  DNI: 'DNI',
  LICENSE: 'Licencia',
  ART: 'ART',
  PSYCHOPHYSICAL: 'Psicofísico',
};

/**
 * Driver's own documentation (P-CH-3), read-only: the driver can view and
 * open their documents but not upload them — uploading is Admin-only
 * (compliance decision). New documents are loaded by the Admin.
 */
export function MiDocumentacionPage() {
  const { user } = useAuth();
  const driverId = user?.id ?? 0;
  const [docs, setDocs] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    setLoading(true);
    documentsApi
      .list(driverId)
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [driverId]);

  async function handleOpen(documentId: number) {
    setError(null);
    try {
      await documentsApi.open(driverId, documentId);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Box>
      <PageHeader title="Documentación" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Typography variant="body2" color="text.secondary">Cargando…</Typography>
      ) : docs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No tenés documentos cargados. Los carga el administrador.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {docs.map((d) => (
            <Card key={d.id} variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{DOC_LABELS[d.documentType] ?? d.documentType}</Typography>
                      {d.expired && <Chip size="small" label="Vencido" color="error" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Vence: {new Date(d.expiryDate).toLocaleDateString('es-AR')}
                    </Typography>
                  </Stack>
                  <IconButton onClick={() => handleOpen(d.id)} aria-label="Abrir">
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
