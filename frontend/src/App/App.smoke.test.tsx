import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import type { PaletteMode } from '@mui/material';
import { api } from '@/api/axios';
import type { Role } from '@/api/types';
import { AppLocalizationProvider } from '@/components/AppLocalizationProvider/AppLocalizationProvider';
import { AppThemeProvider } from '@/components/AppThemeProvider/AppThemeProvider';
import { NotificationProvider } from '@/components/NotificationProvider/NotificationProvider';
import { useAuthStore } from '@/stores/auth-store';
import { useColorModeStore } from '@/stores/color-mode-store';
import App from './App';

/**
 * Smoke test: boots the real app (router, guards, layouts, theme, providers)
 * against a simulated API and visits every screen of every role, in light and
 * dark mode. It catches what type-checking cannot: a page that crashes on
 * render, a hook used outside its provider, a theme override that throws for
 * some prop combination, or a React warning printed to the console.
 */

// jsdom has no layout engine: Recharts' ResponsiveContainer needs this API.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const NOW = new Date().toISOString();
const USERS: Record<Role, { id: number; name: string; email: string; role: Role }> = {
  ADMIN: { id: 1, name: 'Ana Admin', email: 'admin@empresa.com', role: 'ADMIN' },
  OPERATOR: { id: 2, name: 'Oscar Operador', email: 'operador@empresa.com', role: 'OPERATOR' },
  DRIVER: { id: 3, name: 'Juan Pérez', email: 'chofer@empresa.com', role: 'DRIVER' },
};

const vehicle = {
  id: 7, licensePlate: 'AB123CD', model: 'Iveco Daily', year: 2021, initialKm: 1000, accumulatedKm: 52000,
  lastMaintenanceDate: null, insuranceExpiryDate: '2027-01-10T00:00:00.000Z', insuranceValid: true,
  status: 'ON_TRIP', createdAt: NOW, updatedAt: NOW,
};
const driver = {
  id: 3, name: 'Juan Pérez', email: 'chofer@empresa.com', isActive: true, dni: '30111222',
  licenseCategory: 'C', licenseExpiryDate: '2027-05-01T00:00:00.000Z', licenseValid: true,
  available: false, completedTrips: 12, avgKm: 340,
};
const trip = {
  id: 41, origin: 'Ciudad Industria', destination: 'Rosario', departureAt: NOW, status: 'IN_PROGRESS',
  estimatedDistanceKm: 300, estimatedTimeMin: 200, notes: null, operator: { id: 2, name: 'Oscar Operador' },
  driver: { id: 3, name: 'Juan Pérez', dni: '30111222' }, vehicle: { id: 7, licensePlate: 'AB123CD', model: 'Iveco Daily' },
  departureKm: 52000, arrivalKm: null, assignedAt: NOW, finishedAt: null, createdAt: NOW,
};
const maintenanceType = { id: 2, name: 'Service 10.000 km', description: '', kmAlert: 9000, kmTarget: 10000, monthsAlert: null, monthsTarget: null };
const maintenance = {
  id: 5, vehicle: { id: 7, licensePlate: 'AB123CD', model: 'Iveco Daily' }, maintenanceType: { id: 2, name: 'Service 10.000 km' },
  status: 'COMPLETED', scheduledAt: NOW, completedAt: NOW, km: 50000, notes: null, nextMaintenanceKm: 60000, attachments: [],
};
const alerts = [
  { id: 1, alertType: 'LICENSE_EXPIRED', description: 'Licencia vencida de Lucía', entityType: 'DRIVER', entityId: 4, status: 'PENDING', raisedAt: NOW, resolvedById: null, resolvedAt: null },
  { id: 2, alertType: 'MAINTENANCE_KM_EXCEEDED', description: 'AB123CD superó el km de service', entityType: 'VEHICLE', entityId: 7, status: 'PENDING', raisedAt: NOW, resolvedById: null, resolvedAt: null },
  { id: 3, alertType: 'SOMETHING_NEW', description: 'Tipo desconocido', entityType: 'VEHICLE', entityId: 7, status: 'PENDING', raisedAt: NOW, resolvedById: null, resolvedAt: null },
];
const auditLog = {
  id: 'a1', user: { id: 1, name: 'Ana Admin', email: 'admin@empresa.com' }, action: 'UPDATE', entity: 'VEHICLE',
  entityId: 7, occurredAt: NOW, previousData: { model: 'Iveco' }, newData: { model: 'Iveco Daily' },
};
const list = <T,>(items: T[]) => ({ data: items, meta: { page: 1, limit: 10, total: items.length } });

let role: Role = 'ADMIN';
/** Every request the app made (method, path, query params), for the wiring tests. */
let requests: { method: string; url: string; params: Record<string, unknown> }[] = [];
/** Per-path overrides: a response body, or a rejection with a server message. */
let overrides: Record<string, unknown | { fail: number; message: string }> = {};

function respond(config: InternalAxiosRequestConfig): unknown {
  const url = (config.url ?? '').replace(/^\/api\/v1/, '');
  const method = (config.method ?? 'get').toLowerCase();
  requests.push({ method, url, params: (config.params ?? {}) as Record<string, unknown> });
  const override = overrides[`${method.toUpperCase()} ${url}`];
  if (override && typeof override === 'object' && 'fail' in override) {
    const o = override as { fail: number; message: string };
    throw new AxiosError('Request failed', 'ERR', config, {}, {
      status: o.fail, statusText: '', headers: {}, config, data: { error: { code: 'CONFLICT', message: o.message } },
    });
  }
  if (override !== undefined) return override;
  if (url === '/auth/refresh') return { data: { user: USERS[role], accessToken: 'test-token' } };
  if (url === '/auth/me') return { data: USERS[role] };
  if (url === '/auth/me/profile') {
    return {
      data: {
        ...USERS[role], isActive: true, createdAt: NOW,
        driver: role === 'DRIVER' ? { dni: '30111222', licenseCategory: 'C', licenseExpiryDate: '2027-05-01T00:00:00.000Z', completedTrips: 12, avgKm: 340 } : null,
      },
    };
  }
  if (method !== 'get') return { data: {} };
  if (url === '/dashboard') {
    return {
      data: {
        fleet: { total: 8, available: 5, inWorkshop: 1, onTrip: 1, inactive: 1 },
        trips: { inProgress: 1, pendingAssignment: 2, completed: 400 },
        drivers: { total: 7, active: 6 }, maintenances: { pending: 1 }, alerts: { pending: 3 }, users: { total: 3 },
        tripsPerMonth: [{ month: '2026-07', count: 30 }, { month: '2026-08', count: 45 }, { month: '2026-09', count: 12 }],
      },
    };
  }
  if (url === '/trips') return list([trip]);
  if (url === '/vehicles') return list([vehicle]);
  if (url === '/drivers') return list([driver]);
  if (/^\/drivers\/\d+\/documents$/.test(url)) {
    return { data: [{ id: 9, driverId: 3, documentType: 'ART', expiryDate: '2026-10-01T00:00:00.000Z', expired: false, fileName: 'art.pdf', mimeType: 'application/pdf', fileSize: 1200, uploadedAt: NOW }] };
  }
  if (url === '/users') return list([{ ...USERS.ADMIN, isActive: true, createdAt: NOW, updatedAt: NOW }]);
  if (url === '/maintenances') return list([maintenance]);
  if (url === '/maintenance-types') return list([maintenanceType]);
  if (url === '/alerts') return list(alerts);
  if (url === '/audit-logs') return list([auditLog]);
  if (url === '/settings') {
    return { data: { companyName: 'Transportes SA', taxId: '30-1', address: 'Calle 1', phone: '341', email: 'a@b.com', timezone: 'America/Argentina/Buenos_Aires', language: 'es', dateFormat: 'DD/MM/YYYY', updatedAt: NOW } };
  }
  throw new Error(`Unmocked request: ${method.toUpperCase()} ${url}`);
}

const adapter: AxiosAdapter = async (config) => ({
  data: respond(config),
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const SCREENS: Record<Role, [path: string, heading: string, content: string | RegExp][]> = {
  ADMIN: [
    ['/dashboard', 'Dashboard', 'Viajes por mes'],
    ['/viajes', 'Viajes', 'Rosario'],
    ['/vehiculos', 'Vehículos', 'AB123CD'],
    ['/choferes', 'Choferes', 'Juan Pérez'],
    ['/mantenimiento', 'Mantenimiento', 'Programados'],
    ['/alertas', 'Alertas', 'Licencia vencida de Lucía'],
    ['/usuarios', 'Usuarios', 'admin@empresa.com'],
    ['/auditoria', 'Auditoría', 'Modificación'],
    ['/reportes', 'Reportes', /Elegí el período/],
    ['/configuracion', 'Configuración', 'Guardar cambios'],
    ['/mi-perfil', 'Mis datos', 'admin@empresa.com'],
  ],
  OPERATOR: [
    ['/dashboard', 'Dashboard', 'Viajes por mes'],
    ['/viajes', 'Viajes', 'Rosario'],
    ['/mantenimiento', 'Mantenimiento', 'Programados'],
    ['/alertas', 'Alertas', 'Licencia vencida de Lucía'],
  ],
  DRIVER: [
    ['/mi-viaje', 'Mi viaje actual', 'Rosario'],
    ['/mi-documentacion', 'Documentación', /ART/],
    ['/mi-historial', 'Historial', 'Rosario'],
  ],
};

describe.each(['light', 'dark'] as PaletteMode[])('smoke — every screen renders (%s mode)', (mode) => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    axios.defaults.adapter = adapter;
    api.defaults.adapter = adapter;
    useAuthStore.setState({ user: null, accessToken: null, initializing: true });
    useColorModeStore.setState({ preference: mode });
    consoleError = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    cleanup();
    consoleError.mockRestore();
  });

  const cases = (Object.keys(SCREENS) as Role[]).flatMap((r) => SCREENS[r].map((s) => [r, ...s] as const));

  it.each(cases)('%s %s', async (r, path, heading, content) => {
    role = r;
    window.history.pushState({}, '', path);
    render(
      <AppLocalizationProvider>
        <AppThemeProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AppThemeProvider>
      </AppLocalizationProvider>,
    );

    expect(await screen.findByRole('heading', { name: heading }, { timeout: 4000 })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(content).length).toBeGreaterThan(0), { timeout: 4000 });
    expect(window.location.pathname).toBe(path);
    expect(consoleError).not.toHaveBeenCalled();
  });
});

function renderApp(r: Role, path: string) {
  role = r;
  window.history.pushState({}, '', path);
  render(
    <AppLocalizationProvider>
      <AppThemeProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AppThemeProvider>
    </AppLocalizationProvider>,
  );
}

describe('wiring — the new controls reach the API and explain rejections', () => {
  beforeEach(() => {
    axios.defaults.adapter = adapter;
    api.defaults.adapter = adapter;
    useAuthStore.setState({ user: null, accessToken: null, initializing: true });
    useColorModeStore.setState({ preference: 'light' });
    requests = [];
    overrides = {};
  });

  afterEach(() => cleanup());

  const lastGet = (url: string) => [...requests].reverse().find((q) => q.method === 'get' && q.url === url);

  it('Viajes: the search box sends `search` to the server', async () => {
    renderApp('OPERATOR', '/viajes');
    const box = await screen.findByPlaceholderText('Chofer o destino');
    fireEvent.change(box, { target: { value: 'Pérez' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(lastGet('/trips')?.params).toMatchObject({ search: 'Pérez', page: 1 }));
  });

  it('Mantenimiento: clicking a column header sorts on the server', async () => {
    renderApp('ADMIN', '/mantenimiento');
    await screen.findByRole('heading', { name: 'Mantenimiento' });
    await waitFor(() => expect(lastGet('/maintenances')?.params).toMatchObject({ view: 'scheduled', sortBy: 'scheduledAt', sortOrder: 'desc' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Km' }));
    await waitFor(() => expect(lastGet('/maintenances')?.params).toMatchObject({ sortBy: 'km', sortOrder: 'asc' }));
  });

  it('Alertas: the list asks for pending alerts, newest first', async () => {
    renderApp('ADMIN', '/alertas');
    await screen.findAllByText('Licencia vencida de Lucía');
    expect(lastGet('/alerts')?.params).toMatchObject({ status: 'PENDING', sortBy: 'raisedAt', sortOrder: 'desc' });
    // Each card says its type as a heading; the unknown type still renders.
    expect(screen.getByRole('heading', { name: 'Licencia vencida' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'SOMETHING_NEW' })).toBeTruthy();
  });

  it('a rejected one-click action shows the server reason in a pop-up notice', async () => {
    overrides['GET /maintenances'] = list([{ ...maintenance, status: 'PENDING', completedAt: null }]);
    overrides['POST /maintenances/5/start'] = { fail: 409, message: 'El vehículo AB123CD está en viaje' };
    renderApp('ADMIN', '/mantenimiento');
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('El vehículo AB123CD está en viaje');
  });

  it('a rejected confirmed action keeps its dialog open with the reason inside', async () => {
    overrides['POST /trips/41/cancel'] = { fail: 409, message: 'No se puede cancelar un viaje finalizado' };
    renderApp('OPERATOR', '/viajes');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar viaje' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar viaje' }));
    await waitFor(() => expect(within(dialog).getByText('No se puede cancelar un viaje finalizado')).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('a successful action confirms it with a notice', async () => {
    renderApp('OPERATOR', '/viajes');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar viaje' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar viaje' }));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Viaje a Rosario cancelado');
  });
});
