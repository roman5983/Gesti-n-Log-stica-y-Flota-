import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useAuthStore } from './stores/auth-store';
import { authStore } from './stores/auth-store';
import { authApi } from './api/auth.api';
import { RequireAuth, RequireRole, homePathForRole } from './auth/guards';
import { AdminLayout } from './layouts/AdminLayout';
import { OperadorLayout } from './layouts/OperadorLayout';
import { ChoferLayout } from './layouts/ChoferLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsuariosPage } from './pages/usuarios/UsuariosPage';
import { VehiculosPage } from './pages/vehiculos/VehiculosPage';
import { ChoferesPage } from './pages/choferes/ChoferesPage';
import { MantenimientoPage } from './pages/mantenimiento/MantenimientoPage';
import { ViajesPage } from './pages/viajes/ViajesPage';
import { AlertasPage } from './pages/alertas/AlertasPage';
import { ReportesPage } from './pages/reportes/ReportesPage';
import { AuditoriaPage } from './pages/auditoria/AuditoriaPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import { MisDatosPage } from './pages/perfil/MisDatosPage';
import { MiViajePage } from './pages/chofer/MiViajePage';
import { MiDocumentacionPage } from './pages/chofer/MiDocumentacionPage';
import { MiHistorialPage } from './pages/chofer/MiHistorialPage';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * On startup, try to re-hydrate the session from the refresh cookie: the
 * access token lives only in memory and is lost on reload. If refresh
 * succeeds we fetch the current user; either way we mark init as done so the
 * guards can decide.
 */
function useBootstrapSession() {
  const setSession = useAuthStore((s) => s.setSession);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post<{ data: { accessToken: string } }>(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        if (cancelled) return;
        authStore.setAccessToken(data.data.accessToken);
        const user = await authApi.me();
        if (!cancelled) setSession(user, data.data.accessToken);
      } catch {
        // No valid refresh cookie — stay logged out.
      } finally {
        if (!cancelled) setInitialized();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSession, setInitialized]);
}

/** Redirects "/" to the appropriate home for the current role. */
function RoleHome() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />;
}

export default function App() {
  useBootstrapSession();
  const initializing = useAuthStore((s) => s.initializing);

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Shared for every authenticated role — same page, layout by role.
            Must come first: a path listed here wins over the role groups. */}
        <Route
          element={
            <RequireAuth>
              <RoleShell />
            </RequireAuth>
          }
        >
          <Route path="/mi-perfil" element={<MisDatosPage />} />
        </Route>

        {/* Admin + Operator web app (dark sidebar layout) */}
        <Route
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN', 'OPERATOR']}>
                <RoleShellSwitch />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/viajes" element={<ViajesPage />} />
          <Route path="/vehiculos" element={<VehiculosPage />} />
          <Route path="/choferes" element={<ChoferesPage />} />
          <Route path="/mantenimiento" element={<MantenimientoPage />} />
          <Route path="/alertas" element={<AlertasPage />} />
        </Route>

        {/* Admin-only sections */}
        <Route
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/reportes" element={<ReportesPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Route>

        {/* Driver mobile app (bottom navigation) */}
        <Route
          element={
            <RequireAuth>
              <RequireRole roles={['DRIVER']}>
                <ChoferLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route path="/mi-viaje" element={<MiViajePage />} />
          <Route path="/mi-documentacion" element={<MiDocumentacionPage />} />
          <Route path="/mi-historial" element={<MiHistorialPage />} />
        </Route>

        <Route path="/" element={<RoleHome />} />
        <Route path="*" element={<RoleHome />} />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Admin and Operator share the /dashboard, /viajes, … routes but see
 * different sidebars, so the shell is chosen by role.
 */
function RoleShellSwitch() {
  const role = useAuthStore((s) => s.user?.role);
  return role === 'ADMIN' ? <AdminLayout /> : <OperadorLayout />;
}

/** Layout for routes shared by every role (e.g. /mi-perfil), chosen by role. */
function RoleShell() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'ADMIN') return <AdminLayout />;
  if (role === 'OPERATOR') return <OperadorLayout />;
  return <ChoferLayout />;
}
