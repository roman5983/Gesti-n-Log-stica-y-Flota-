import { SidebarLayout } from '@/layouts/SidebarLayout/SidebarLayout';
import { NAV_ITEMS } from './AdminLayout.data';

export function AdminLayout() {
  return <SidebarLayout title="Administración" navItems={NAV_ITEMS} />;
}
