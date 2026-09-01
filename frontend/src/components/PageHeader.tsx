import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

/** Page title with an optional action area (e.g. a "+ New" button). */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 3 }}
      spacing={2}
    >
      <Typography variant="h4">{title}</Typography>
      {action && <Box>{action}</Box>}
    </Stack>
  );
}
