import type { ReactNode } from 'react';
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';

/** KPI summary card for the dashboard (P-AD-1 / P-OP-1). */
export function KpiCard({
  label,
  value,
  icon,
  color = 'primary.main',
  to,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  /** When set, the whole card becomes a shortcut to this route. */
  to?: string;
}) {
  const body = (
    <CardContent sx={{ position: 'relative' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h4">{value}</Typography>
        </Stack>
        {icon && <Stack sx={{ color, fontSize: 40 }}>{icon}</Stack>}
      </Stack>
      {to && (
        <Box
          aria-hidden
          sx={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', color: 'text.disabled' }}
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
