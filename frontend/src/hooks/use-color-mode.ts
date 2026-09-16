import type { PaletteMode } from '@mui/material';
import {
  resolveColorMode,
  useColorModeStore,
  type ColorPreference,
} from '../stores/color-mode-store';

export interface ColorModeApi {
  /** The mode actually being rendered right now. */
  mode: PaletteMode;
  /** What the user asked for ('system' until they choose explicitly). */
  preference: ColorPreference;
  /** Flips to the opposite of what is on screen, as an explicit choice. */
  toggle: () => void;
  /** Sets an explicit mode, or 'system' to go back to following the OS. */
  setPreference: (preference: ColorPreference) => void;
}

/** Color mode hook: exposes the current theme mode and how to change it. */
export function useColorMode(): ColorModeApi {
  const preference = useColorModeStore((s) => s.preference);
  const systemMode = useColorModeStore((s) => s.systemMode);
  const setPreference = useColorModeStore((s) => s.setPreference);

  const mode = resolveColorMode(preference, systemMode);

  return {
    mode,
    preference,
    setPreference,
    toggle: () => setPreference(mode === 'dark' ? 'light' : 'dark'),
  };
}
