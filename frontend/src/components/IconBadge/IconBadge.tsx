import { Box } from '@mui/material';
import { badgeSx } from './IconBadge.styles';
import type { IconBadgeProps } from './IconBadge.types';

/** An icon inside a tinted circle of its tone (KPI cards, alert cards). Decorative: the text next to it carries the meaning. */
export function IconBadge({ children, tone, size = 48, muted = false }: IconBadgeProps) {
  return (
    <Box aria-hidden sx={badgeSx(size, tone, muted)}>
      {children}
    </Box>
  );
}
