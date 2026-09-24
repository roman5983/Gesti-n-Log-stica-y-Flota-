import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLocalizationProvider } from '@/components/AppLocalizationProvider/AppLocalizationProvider';
import { AppThemeProvider } from '@/components/AppThemeProvider/AppThemeProvider';
import { NotificationProvider } from '@/components/NotificationProvider/NotificationProvider';
import App from '@/App/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLocalizationProvider>
      <AppThemeProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AppThemeProvider>
    </AppLocalizationProvider>
  </StrictMode>,
);
