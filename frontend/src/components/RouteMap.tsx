import { Box, Button, Stack, Typography } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Trip route on Google Maps (C-3). Works without configuration:
 *  - With VITE_GOOGLE_MAPS_API_KEY set → embeds the route via the Maps Embed
 *    API (an iframe; lowest-cost option, no JS SDK).
 *  - Without a key → shows a button that opens the route on google.com/maps.
 */
export function RouteMap({
  origin,
  destination,
  height = 300,
}: {
  origin: string;
  destination: string;
  height?: number;
}) {
  const externalUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

  if (!MAPS_KEY) {
    return (
      <Stack spacing={1} alignItems="flex-start">
        <Button variant="outlined" startIcon={<OpenInNewIcon />} href={externalUrl} target="_blank" rel="noopener">
          Ver recorrido en Google Maps
        </Button>
        <Typography variant="caption" color="text.secondary">
          <MapIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
          Configurá VITE_GOOGLE_MAPS_API_KEY para ver el mapa embebido.
        </Typography>
      </Stack>
    );
  }

  const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;

  return (
    <Box sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
      <iframe
        title="Recorrido del viaje"
        width="100%"
        height={height}
        style={{ border: 0, display: 'block' }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
      />
    </Box>
  );
}
