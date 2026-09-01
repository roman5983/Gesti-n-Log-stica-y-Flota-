import type { ReactNode } from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';

/** KPI summary card for the dashboard (P-AD-1 / P-OP-1). */
export function KpiCard({
  label,
  value,
  icon,
  color = 'primary.main',
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h4">{value}</Typography>
          </Stack>
          {icon && <Stack sx={{ color, fontSize: 40 }}>{icon}</Stack>}
        </Stack>
      </CardContent>
    </Card>
  );
}
