import { SidebarLayout } from '@/layouts/SidebarLayout/SidebarLayout';
import { NAV_ITEMS } from './OperatorLayout.data';

export function OperatorLayout() {
  return <SidebarLayout title="Operación" navItems={NAV_ITEMS} />;
}
