import { create } from 'zustand';
import type { PaletteMode } from '@mui/material';

/**
 * Color mode store (Zustand).
 *
 * Three-state preference instead of a plain boolean:
 *  - 'system' (default on first visit): follow the OS/browser setting and keep
 *    following it live if the user switches their system theme.
 *  - 'light' / 'dark': an explicit choice made by the user, which wins over the
 *    system setting and survives across sessions.
 *
 * Unlike the access token (kept in memory only — see auth-store), the color
 * mode is not sensitive, so persisting it in localStorage is fine and is what
 * makes the preference survive a reload.
 */

export type ColorPreference = PaletteMode | 'system';

const STORAGE_KEY = 'ui.color-mode';

/** localStorage throws in some contexts (Safari private mode, storage disabled
 *  by policy), and a theme preference is never worth crashing the app over. */
function readStoredPreference(): ColorPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore — fall back to following the system */
  }
  return 'system';
}

function persistPreference(preference: ColorPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* ignore — the preference simply won't survive the reload */
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** `matchMedia` is missing under jsdom, so every access is guarded. */
function readSystemMode(): PaletteMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

interface ColorModeState {
  preference: ColorPreference;
  systemMode: PaletteMode;
  setPreference: (preference: ColorPreference) => void;
  setSystemMode: (systemMode: PaletteMode) => void;
}

export const useColorModeStore = create<ColorModeState>((set) => ({
  preference: readStoredPreference(),
  systemMode: readSystemMode(),
  setPreference: (preference) => {
    persistPreference(preference);
    set({ preference });
  },
  setSystemMode: (systemMode) => set({ systemMode }),
}));

/** Resolves the effective mode: an explicit choice wins over the system one. */
export function resolveColorMode(preference: ColorPreference, systemMode: PaletteMode): PaletteMode {
  return preference === 'system' ? systemMode : preference;
}

// Keep 'system' honest: if the user flips their OS theme while the app is open
// and they never picked a mode by hand, the app follows along. Registered once
// at module level (rather than in an effect) so it cannot be duplicated by
// StrictMode's double-mount in development.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
    useColorModeStore.getState().setSystemMode(event.matches ? 'dark' : 'light');
  });
}
