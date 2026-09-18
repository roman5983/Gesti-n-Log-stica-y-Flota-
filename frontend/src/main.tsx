import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/es';
import { AppThemeProvider } from './components/AppThemeProvider';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </LocalizationProvider>
  </StrictMode>,
);
