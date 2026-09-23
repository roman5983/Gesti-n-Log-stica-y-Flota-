import type { SvgIconComponent } from '@mui/icons-material';

export interface NavItem {
  label: string;
  path: string;
  /** Icon component (not an element), so nav data can live in plain .data.ts files. */
  icon: SvgIconComponent;
}

export interface SidebarLayoutProps {
  title: string;
  navItems: NavItem[];
}
