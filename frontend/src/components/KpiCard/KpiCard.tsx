import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';
import { IconBadge } from '@/components/IconBadge/IconBadge';
import type { KpiCardProps } from './KpiCard.types';

/**
 * KPI summary card for the dashboard (P-AD-1 / P-OP-1).
 *
 * The icon sits in a soft badge of its tone (tinted circle + icon in the
 * tone's text shade), so each metric is recognizable by icon *and* color, and
 * the label always states what it is — color never carries the meaning alone.
 */
export function KpiCard({
  label,
  value,
  icon,
  tone = 'accent',
  to,
}: KpiCardProps) {
  const body = (
    <CardContent sx={{ position: 'relative' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4">{value}</Typography>
        </Stack>
        {icon && <IconBadge tone={tone}>{icon}</IconBadge>}
      </Stack>
      {to && (
        <Box
          aria-hidden
          sx={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', color: 'text.secondary' }}
        >
          <ArrowForwardIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%' }}>
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}
