import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from '../../components/StatusChip';
import { authApi } from '../../api/auth.api';
import { apiErrorMessage } from '../../api/axios';
import type { UserProfile } from '../../api/types';

const LICENSE_LABELS: Record<string, string> = {
  A: 'A — Motos',
  B: 'B — Autos y camionetas',
  C: 'C — Camiones',
  E: 'E — Camiones con acoplado',
};

/** One label/value line inside a data card. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{ py: 1.25 }}
      spacing={{ xs: 0.25, sm: 2 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 200 }}>
        {label}
      </Typography>
      <Box sx={{ fontWeight: 500 }}>{children}</Box>
    </Stack>
  );
}

/**
 * "Mis datos" — read-only profile for every role (Admin / Operador / Chofer).
 * Shows the account fields; for a driver it also shows the driver profile.
 * Changes are made by an administrator from user management.
 */
export function MisDatosPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .profile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
  if (!profile) return null;

  const memberSince = new Date(profile.createdAt).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Box>
      <PageHeader title="Mis datos" />

      <Alert severity="info" sx={{ mb: 2 }}>
        Esta información es solo de consulta. Para modificar tus datos, contactá a un administrador.
      </Alert>

      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Datos de la cuenta
            </Typography>
            <Divider />
            <Row label="Nombre">{profile.name}</Row>
            <Divider />
            <Row label="Usuario (email)">{profile.email}</Row>
            <Divider />
            <Row label="Rol">
              <StatusChip status={profile.role} />
            </Row>
            <Divider />
            <Row label="Estado">
              <StatusChip status={profile.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </Row>
            <Divider />
            <Row label="Miembro desde">{memberSince}</Row>
          </CardContent>
        </Card>

        {profile.driver && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Datos de chofer
              </Typography>
              <Divider />
              <Row label="DNI">{profile.driver.dni}</Row>
              <Divider />
              <Row label="Categoría de licencia">
                {LICENSE_LABELS[profile.driver.licenseCategory] ?? profile.driver.licenseCategory}
              </Row>
              <Divider />
              <Row label="Vencimiento de licencia">
                {new Date(profile.driver.licenseExpiryDate).toLocaleDateString('es-AR')}
              </Row>
              <Divider />
              <Row label="Viajes realizados">{profile.driver.completedTrips}</Row>
              <Divider />
              <Row label="Promedio de km por viaje">
                {profile.driver.avgKm.toLocaleString('es-AR')} km
              </Row>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
}
