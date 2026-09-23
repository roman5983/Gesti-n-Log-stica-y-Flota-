import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLocalizationProvider } from './components/AppLocalizationProvider';
import { AppThemeProvider } from './components/AppThemeProvider';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLocalizationProvider>
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </AppLocalizationProvider>
  </StrictMode>,
);
