import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

/**
 * The layouts' <Outlet /> behind a Suspense boundary. Each screen is its own
 * chunk (React.lazy in App.tsx), downloaded the first time it's opened: while
 * it arrives, only the content area shows a spinner and the sidebar or the
 * bottom navigation stay in place.
 */
export function PageOutlet() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress aria-label="Cargando pantalla" />
        </Box>
      }
    >
      <Outlet />
    </Suspense>
  );
}
