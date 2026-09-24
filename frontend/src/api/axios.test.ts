import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { apiErrorMessage } from './axios';

/** Builds the error axios would reject with for a given response. */
function httpError(status: number | undefined, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response =
    status === undefined
      ? undefined
      : ({ status, statusText: '', headers: {}, config, data } as AxiosResponse);
  return new AxiosError('Request failed', 'ERR', config, {}, response);
}

describe('apiErrorMessage — user-facing error messages (Spanish)', () => {
  it('uses the server message, which explains the business rule', () => {
    const err = httpError(409, { error: { code: 'CONFLICT', message: 'El vehículo tiene un viaje en curso' } });
    expect(apiErrorMessage(err)).toBe('El vehículo tiene un viaje en curso');
  });

  it('names the field in Spanish on validation errors', () => {
    const err = httpError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de la solicitud inválidos',
        details: [{ path: 'destination', message: 'Debe tener al menos 2 caracteres' }],
      },
    });
    expect(apiErrorMessage(err)).toBe(
      'Datos de la solicitud inválidos (Destino: Debe tener al menos 2 caracteres)',
    );
  });

  it('without a response (server down / offline) says so and suggests what to do', () => {
    expect(apiErrorMessage(httpError(undefined))).toMatch(/No se pudo conectar con el servidor/);
  });

  it('without a server message, explains by HTTP status', () => {
    expect(apiErrorMessage(httpError(403))).toMatch(/No tenés permisos/);
    expect(apiErrorMessage(httpError(429))).toMatch(/Demasiados intentos/);
    expect(apiErrorMessage(httpError(503))).toMatch(/se está iniciando/);
    expect(apiErrorMessage(httpError(500))).toMatch(/error en el servidor/);
  });

  it('uses the fallback only when there is nothing better to say', () => {
    expect(apiErrorMessage(new Error('boom'), 'No se pudo guardar')).toBe('No se pudo guardar');
    expect(apiErrorMessage(httpError(400, {}), 'No se pudo guardar')).toBe('No se pudo guardar');
  });
});
