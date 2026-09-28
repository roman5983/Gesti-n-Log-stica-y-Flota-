import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/stores/auth-store';
import { RequireAuth, RequireRole } from '@/auth/guards/guards';
import { homePathForRole } from '@/auth/guards/guards.helpers';
import { AdminLayout } from '@/layouts/AdminLayout/AdminLayout';
import { OperatorLayout } from '@/layouts/OperatorLayout/OperatorLayout';
import { DriverLayout } from '@/layouts/DriverLayout/DriverLayout';
import { LoginPage } from '@/pages/auth/LoginPage/LoginPage';
import { useBootstrapSession } from '@/hooks/useBootstrapSession';

/**
 * Every screen except Login is loaded on demand: the first bundle carries the
 * shell (router, theme, layouts, login) and each page arrives as its own chunk
 * the first time it's opened. The layouts show a spinner meanwhile (PageOutlet).
 */
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const UsersPage = lazy(() => import('@/pages/users/UsersPage/UsersPage').then((m) => ({ default: m.UsersPage })));
const VehiclesPage = lazy(() => import('@/pages/vehicles/VehiclesPage/VehiclesPage').then((m) => ({ default: m.VehiclesPage })));
const DriversPage = lazy(() => import('@/pages/drivers/DriversPage/DriversPage').then((m) => ({ default: m.DriversPage })));
const MaintenancePage = lazy(() => import('@/pages/maintenance/MaintenancePage/MaintenancePage').then((m) => ({ default: m.MaintenancePage })));
const TripsPage = lazy(() => import('@/pages/trips/TripsPage/TripsPage').then((m) => ({ default: m.TripsPage })));
const AlertsPage = lazy(() => import('@/pages/alerts/AlertsPage/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AuditLogPage = lazy(() => import('@/pages/audit/AuditLogPage/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MyProfilePage = lazy(() => import('@/pages/profile/MyProfilePage/MyProfilePage').then((m) => ({ default: m.MyProfilePage })));
const MyTripPage = lazy(() => import('@/pages/driver-portal/MyTripPage/MyTripPage').then((m) => ({ default: m.MyTripPage })));
const MyDocumentsPage = lazy(() => import('@/pages/driver-portal/MyDocumentsPage/MyDocumentsPage').then((m) => ({ default: m.MyDocumentsPage })));
const MyTripHistoryPage = lazy(() => import('@/pages/driver-portal/MyTripHistoryPage/MyTripHistoryPage').then((m) => ({ default: m.MyTripHistoryPage })));

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
          <Route path="/mi-perfil" element={<MyProfilePage />} />
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
          <Route path="/viajes" element={<TripsPage />} />
          <Route path="/vehiculos" element={<VehiclesPage />} />
          <Route path="/choferes" element={<DriversPage />} />
          <Route path="/mantenimiento" element={<MaintenancePage />} />
          <Route path="/alertas" element={<AlertsPage />} />
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
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/auditoria" element={<AuditLogPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Route>

        {/* Driver mobile app (bottom navigation) */}
        <Route
          element={
            <RequireAuth>
              <RequireRole roles={['DRIVER']}>
                <DriverLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route path="/mi-viaje" element={<MyTripPage />} />
          <Route path="/mi-documentacion" element={<MyDocumentsPage />} />
          <Route path="/mi-historial" element={<MyTripHistoryPage />} />
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
  return role === 'ADMIN' ? <AdminLayout /> : <OperatorLayout />;
}

/** Layout for routes shared by every role (e.g. /mi-perfil), chosen by role. */
function RoleShell() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'ADMIN') return <AdminLayout />;
  if (role === 'OPERATOR') return <OperatorLayout />;
  return <DriverLayout />;
}
