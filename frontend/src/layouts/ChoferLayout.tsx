import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AppBar, Box, BottomNavigation, BottomNavigationAction, IconButton, Paper, Toolbar, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/use-auth';
import { ConfirmDialog } from '../components/ConfirmDialog';

/** Driver layout: mobile-style with bottom navigation (DOC-5 §5.3). */
const navItems = [
  { label: 'Viaje', path: '/mi-viaje', icon: <LocalShippingIcon /> },
  { label: 'Documentación', path: '/mi-documentacion', icon: <DescriptionIcon /> },
  { label: 'Historial', path: '/mi-historial', icon: <HistoryIcon /> },
];

export function ChoferLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleLogout() {
    setLogoutOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <Box sx={{ minHeight: '100vh', pb: 8, maxWidth: 480, mx: 'auto' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Gestión Logística
          </Typography>
          <IconButton color="inherit" onClick={() => setLogoutOpen(true)} aria-label="Cerrar sesión">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ p: 2 }}>
        <Outlet />
      </Box>

      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, mx: 'auto' }} elevation={3}>
        <BottomNavigation showLabels>
          {navItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              icon={item.icon}
              sx={{ '&.active': { color: 'primary.main' } }}
            />
          ))}
        </BottomNavigation>
      </Paper>

      <ConfirmDialog
        open={logoutOpen}
        title="Cerrar sesión"
        message="¿Seguro que querés cerrar sesión?"
        confirmLabel="Cerrar sesión"
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </Box>
  );
}
