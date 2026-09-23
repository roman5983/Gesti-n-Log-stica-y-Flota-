import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DescriptionIcon from '@mui/icons-material/Description';
import HistoryIcon from '@mui/icons-material/History';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import type { NavItem } from '@/layouts/SidebarLayout/SidebarLayout.types';

/** Driver layout: mobile-style with bottom navigation (DOC-5 §5.3). */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Viaje', path: '/mi-viaje', icon: LocalShippingIcon },
  { label: 'Documentación', path: '/mi-documentacion', icon: DescriptionIcon },
  { label: 'Historial', path: '/mi-historial', icon: HistoryIcon },
  { label: 'Mis datos', path: '/mi-perfil', icon: AccountCircleIcon },
];
