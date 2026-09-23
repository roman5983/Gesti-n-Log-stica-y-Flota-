import type { SvgIconComponent } from '@mui/icons-material';
import BadgeIcon from '@mui/icons-material/Badge';
import DescriptionIcon from '@mui/icons-material/Description';
import ShieldIcon from '@mui/icons-material/Shield';
import BuildIcon from '@mui/icons-material/Build';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import NotificationsIcon from '@mui/icons-material/Notifications';
import type { AlertCategory, AlertPresentation } from './AlertCard.types';

export const ICONS: Record<AlertCategory, SvgIconComponent> = {
  license: BadgeIcon,
  document: DescriptionIcon,
  insurance: ShieldIcon,
  maintenance: BuildIcon,
  vehicle: PauseCircleIcon,
  other: NotificationsIcon,
};

/** Category names for the "Tipo" filter groups. */
export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  license: 'Licencias',
  document: 'Documentación',
  insurance: 'Seguros',
  maintenance: 'Mantenimiento',
  vehicle: 'Vehículos',
  other: 'Otras',
};

export const TYPES: Record<string, Omit<AlertPresentation, 'icon'>> = {
  LICENSE_EXPIRED: { label: 'Licencia vencida', category: 'license', tone: 'error', tag: 'Vencida' },
  LICENSE_EXPIRING: { label: 'Licencia por vencer', category: 'license', tone: 'warning', tag: 'Por vencer' },
  DOCUMENT_EXPIRED: { label: 'Documento vencido', category: 'document', tone: 'error', tag: 'Vencido' },
  DOCUMENT_EXPIRING: { label: 'Documento por vencer', category: 'document', tone: 'warning', tag: 'Por vencer' },
  INSURANCE_EXPIRED: { label: 'Seguro vencido', category: 'insurance', tone: 'error', tag: 'Vencido' },
  INSURANCE_EXPIRING: { label: 'Seguro por vencer', category: 'insurance', tone: 'warning', tag: 'Por vencer' },
  MAINTENANCE_KM_EXCEEDED: {
    label: 'Km de mantenimiento superado',
    category: 'maintenance',
    tone: 'warning',
    tag: 'Requiere service',
  },
  VEHICLE_INACTIVE: { label: 'Vehículo inactivo', category: 'vehicle', tone: 'info' },
};

/** Alert types in the order they are offered in the filter (grouped by category). */
export const ALERT_TYPE_CODES = Object.keys(TYPES);
