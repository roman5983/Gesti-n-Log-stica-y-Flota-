import DashboardIcon from '@mui/icons-material/Dashboard';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BadgeIcon from '@mui/icons-material/Badge';
import BuildIcon from '@mui/icons-material/Build';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { AppSidebarLayout, type NavItem } from '../components/AppSidebarLayout';

/** Operator sidebar (DOC-5 §5.1) — no Users/Audit/Config/Reports. */
const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Viajes', path: '/viajes', icon: <LocalShippingIcon /> },
  { label: 'Vehículos', path: '/vehiculos', icon: <DirectionsCarIcon /> },
  { label: 'Choferes', path: '/choferes', icon: <BadgeIcon /> },
  { label: 'Mantenimiento', path: '/mantenimiento', icon: <BuildIcon /> },
  { label: 'Alertas', path: '/alertas', icon: <NotificationsActiveIcon /> },
  { label: 'Mis datos', path: '/mi-perfil', icon: <AccountCircleIcon /> },
];

export function OperadorLayout() {
  return <AppSidebarLayout title="Operación" navItems={navItems} />;
}
