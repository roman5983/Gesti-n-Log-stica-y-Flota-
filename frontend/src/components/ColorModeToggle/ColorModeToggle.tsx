import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useColorMode } from '@/hooks/useColorMode';

/** Light/dark switch for the top bar. Shows the mode it will switch *to*. */
export function ColorModeToggle() {
  const { mode, toggle } = useColorMode();
  const isDark = mode === 'dark';
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <Tooltip title={label}>
      <IconButton color="inherit" onClick={toggle} aria-label={label}>
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
