import type { ReactNode } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { esES } from '@mui/x-date-pickers/locales';
import 'dayjs/locale/es';

/**
 * Date pickers in Spanish: month and day names and first day of the week
 * from dayjs's "es" locale; the picker's own texts (placeholders DD/MM/AAAA,
 * "Seleccionar fecha", "Cancelar", button labels) from MUI's esES pack.
 */
const LOCALE_TEXT = esES.components.MuiLocalizationProvider.defaultProps.localeText;

export function AppLocalizationProvider({ children }: { children: ReactNode }) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es" localeText={LOCALE_TEXT}>
      {children}
    </LocalizationProvider>
  );
}
