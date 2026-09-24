import { Box, Stack, Typography } from '@mui/material';
import type { PageHeaderProps } from './PageHeader.types';

/** Page title with an optional action area (e.g. a "+ New" button). */
export function PageHeader({ title, action }: PageHeaderProps) {
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
