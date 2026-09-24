import { ReactNode } from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LOCALE_TEXT } from './AppLocalizationProvider.data';

export function AppLocalizationProvider({ children }: { children: ReactNode }) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es" localeText={LOCALE_TEXT}>
      {children}
    </LocalizationProvider>
  );
}
