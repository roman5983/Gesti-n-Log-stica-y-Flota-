import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { AlertCard } from './AlertCard';
import { buildTheme } from '@/theme/theme';
import type { Alert } from '@/api/alerts.api';

const base: Alert = {
  id: 1,
  alertType: 'LICENSE_EXPIRED',
  description: 'La licencia de Nicolás Díaz venció el 10/09/2026',
  entityType: 'DRIVER',
  entityId: 12,
  status: 'PENDING',
  raisedAt: new Date().toISOString(),
  resolvedById: null,
  resolvedAt: null,
};

function renderCard(alert: Alert) {
  return render(
    <ThemeProvider theme={buildTheme('light')}>
      <AlertCard alert={alert} actions={<button type="button">Resolver</button>} />
    </ThemeProvider>,
  );
}

describe('AlertCard', () => {
  it('shows the type as title, the urgency in words, the description and the entity', () => {
    renderCard(base);
    expect(screen.getByRole('heading', { name: 'Licencia vencida' })).toBeTruthy();
    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.getByText(base.description)).toBeTruthy();
    expect(screen.getByText(/Chofer #12/)).toBeTruthy();
    expect(screen.getByText(/^Hoy \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeTruthy();
  });

  it('a resolved alert says so and drops the urgency tag', () => {
    renderCard({ ...base, status: 'RESOLVED', resolvedAt: new Date().toISOString() });
    expect(screen.getByText('Resuelta')).toBeTruthy();
    expect(screen.queryByText('Vencida')).toBeNull();
  });

  it('is announced as an article with its type and description (screen readers)', () => {
    renderCard(base);
    expect(screen.getByRole('article', { name: `Licencia vencida: ${base.description}` })).toBeTruthy();
  });
});
