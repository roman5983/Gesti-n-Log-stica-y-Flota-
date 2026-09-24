import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { authStore } from '@/stores/auth-store';
import type { ApiError, LoginResponse } from './types';

/**
 * Same-origin by default: the browser always talks to the host that served
 * the SPA, and that host forwards /api to the backend (Vite's dev proxy
 * locally, a Vercel rewrite in production — see vite.config.ts and
 * vercel.json). The refresh cookie is then first-party with SameSite=Strict,
 * which cross-site setups (Vercel + Render on different domains) cannot
 * offer: browsers that block third-party cookies, like Safari, would log
 * the user out on every reload. VITE_API_URL remains as an override.
 */
const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

/** Main API client. withCredentials so the refresh cookie travels. */
export const api = axios.create({ baseURL, withCredentials: true });

/** Attach the in-memory access token to every request. */
api.interceptors.request.use((config) => {
  const token = authStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Transparent refresh: POST /auth/refresh, update the in-memory token.
 * ALL callers (the 401 interceptor AND the startup bootstrap) go through
 * `refreshSession`, which shares a single in-flight request. This matters
 * with the server's refresh-token reuse detection: two parallel refreshes
 * with the same cookie would look like a replay and revoke every session
 * (e.g. React StrictMode double-invoking the bootstrap effect in dev).
 * A failed refresh clears the session (the app redirects to login).
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // A bare axios call (not `api`) to avoid recursive interceptors.
  const { data } = await axios.post<{ data: LoginResponse }>(
    `${baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const token = data.data.accessToken;
  authStore.setAccessToken(token);
  return token;
}

export function refreshSession(): Promise<string> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const token = await refreshSession();
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      } catch {
        authStore.clear();
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Spanish names of the request fields, for validation messages
 * ("Destino: debe tener al menos 2 caracteres" instead of "destination: …").
 * Unknown fields fall back to their raw name.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  email: 'Email',
  password: 'Contraseña',
  role: 'Rol',
  dni: 'DNI',
  licenseCategory: 'Categoría de licencia',
  licenseExpiryDate: 'Vencimiento de licencia',
  licensePlate: 'Patente',
  model: 'Modelo',
  year: 'Año',
  initialKm: 'Kilometraje inicial',
  insuranceExpiryDate: 'Vencimiento del seguro',
  destination: 'Destino',
  departureAt: 'Fecha de salida',
  notes: 'Observaciones',
  estimatedDistanceKm: 'Distancia estimada',
  estimatedTimeMin: 'Tiempo estimado',
  driverId: 'Chofer',
  vehicleId: 'Vehículo',
  arrivalKm: 'Kilometraje final',
  maintenanceTypeId: 'Tipo de mantenimiento',
  scheduledAt: 'Fecha programada',
  km: 'Kilometraje',
  nextMaintenanceKm: 'Próximo mantenimiento (km)',
  kmAlert: 'Aviso (km)',
  kmTarget: 'Objetivo (km)',
  monthsAlert: 'Aviso (meses)',
  monthsTarget: 'Objetivo (meses)',
  documentType: 'Tipo de documento',
  expiryDate: 'Vencimiento',
  companyName: 'Razón social',
  taxId: 'CUIT',
  address: 'Dirección',
  phone: 'Teléfono',
  dateFrom: 'Desde',
  dateTo: 'Hasta',
  search: 'Búsqueda',
};

/**
 * What to tell the user when the server gave no message of its own, by HTTP
 * status. Every text says what happened and, when possible, what to do next.
 */
function messageForStatus(status: number | undefined): string | null {
  if (status === undefined) {
    return 'No se pudo conectar con el servidor. Revisá tu conexión a internet e intentá de nuevo.';
  }
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión para continuar.';
  if (status === 403) return 'No tenés permisos para realizar esta acción.';
  if (status === 404) return 'No se encontró lo que buscabas. Puede que haya sido eliminado.';
  if (status === 409) return 'La acción no se puede realizar en el estado actual. Actualizá la pantalla e intentá de nuevo.';
  if (status === 413) return 'El archivo es demasiado grande.';
  if (status === 429) return 'Demasiados intentos seguidos. Esperá unos minutos y volvé a intentar.';
  // Render's free tier wakes up the service on the first request after a
  // while idle; the proxy answers 502/503/504 meanwhile.
  if (status === 502 || status === 503 || status === 504) {
    return 'El servidor se está iniciando o no responde. Esperá un momento e intentá de nuevo.';
  }
  if (status >= 500) return 'Ocurrió un error en el servidor. Intentá de nuevo en unos minutos.';
  return null;
}

/**
 * Human-readable, Spanish message for a failed API call (banners, dialogs and
 * pop-up notices). Priority: the server's own message (business rules are
 * explained there, e.g. "El vehículo tiene un viaje en curso"), then a message
 * by HTTP status, then `fallback`.
 */
export function apiErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado. Intentá de nuevo.'): string {
  if (!axios.isAxiosError(err)) return fallback;
  const data = err.response?.data as ApiError | undefined;
  const message = data?.error?.message;
  if (!message) return messageForStatus(err.response?.status) ?? fallback;

  const details = data?.error?.details;
  if (data?.error?.code === 'VALIDATION_ERROR' && Array.isArray(details) && details.length > 0) {
    const lines = (details as { path?: string; message?: string }[])
      .map((d) => {
        const field = d.path ? (FIELD_LABELS[d.path] ?? d.path) : '';
        return field ? `${field}: ${d.message}` : d.message;
      })
      .join('; ');
    return `${message} (${lines})`;
  }
  return message;
}
