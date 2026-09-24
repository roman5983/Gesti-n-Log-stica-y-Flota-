import { alpha, type Theme } from '@mui/material';
import { toneMain, toneText } from '@/theme/theme.helpers';
import { TINT_ALPHA } from '@/theme/theme.tokens';
import type { Tone } from '@/theme/theme.types';

/**
 * Soft badge: a tint of the tone behind an icon in the tone's text shade —
 * the same pairing the soft chips use, so it passes the same contrast tests.
 */
export const badgeSx = (size: number, tone: Tone, muted: boolean) => (t: Theme) => ({
  width: size,
  height: size,
  flexShrink: 0,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: Math.round(size * 0.55),
  color: muted ? t.palette.text.secondary : toneText(t, tone),
  bgcolor: muted ? t.palette.action.hover : alpha(toneMain(t, tone), TINT_ALPHA[t.palette.mode]),
});
