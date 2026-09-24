import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { settingsApi, type CompanySettings } from '@/api/settings.api';
import { apiErrorMessage } from '@/api/axios';
import { useNotify } from '@/hooks/useNotify';

/** Company settings screen (P-AD-6), Admin-only. */
export function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();

  useEffect(() => {
    let cancelled = false;
    settingsApi
      .get()
      .then((s) => { if (!cancelled) setSettings(s); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function setField<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const { companyName, taxId, address, phone, email, timezone, language, dateFormat } = settings;
      const updated = await settingsApi.update({ companyName, taxId, address, phone, email, timezone, language, dateFormat });
      setSettings(updated);
      notify.success('Configuración guardada');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Configuración" />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {settings && (
        <form onSubmit={handleSubmit}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Información de la empresa</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Nombre" value={settings.companyName} onChange={(e) => setField('companyName', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="CUIT" value={settings.taxId} onChange={(e) => setField('taxId', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Dirección" value={settings.address} onChange={(e) => setField('address', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Teléfono" value={settings.phone} onChange={(e) => setField('phone', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email" type="email" value={settings.email} onChange={(e) => setField('email', e.target.value)} fullWidth required />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Preferencias del sistema</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField label="Zona horaria" value={settings.timezone} onChange={(e) => setField('timezone', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Idioma" value={settings.language} onChange={(e) => setField('language', e.target.value)} fullWidth required />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Formato de fecha" value={settings.dateFormat} onChange={(e) => setField('dateFormat', e.target.value)} fullWidth required />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Stack direction="row" justifyContent="flex-end">
            <Button type="submit" variant="contained" disabled={saving}>
              Guardar cambios
            </Button>
          </Stack>
        </form>
      )}

    </Box>
  );
}
