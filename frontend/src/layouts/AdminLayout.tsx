import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import BadgeIcon from '@mui/icons-material/Badge';
import BuildIcon from '@mui/icons-material/Build';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { AppSidebarLayout, type NavItem } from '../components/AppSidebarLayout';

/** Admin sidebar (DOC-5 §5.2). */
const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Usuarios', path: '/usuarios', icon: <PeopleIcon /> },
  { label: 'Viajes', path: '/viajes', icon: <LocalShippingIcon /> },
  { label: 'Vehículos', path: '/vehiculos', icon: <DirectionsCarIcon /> },
  { label: 'Choferes', path: '/choferes', icon: <BadgeIcon /> },
  { label: 'Mantenimiento', path: '/mantenimiento', icon: <BuildIcon /> },
  { label: 'Alertas', path: '/alertas', icon: <NotificationsActiveIcon /> },
  { label: 'Auditoría', path: '/auditoria', icon: <HistoryIcon /> },
  { label: 'Reportes', path: '/reportes', icon: <AssessmentIcon /> },
  { label: 'Configuración', path: '/configuracion', icon: <SettingsIcon /> },
  { label: 'Mis datos', path: '/mi-perfil', icon: <AccountCircleIcon /> },
];

export function AdminLayout() {
  return <AppSidebarLayout title="Administración" navItems={navItems} />;
}
