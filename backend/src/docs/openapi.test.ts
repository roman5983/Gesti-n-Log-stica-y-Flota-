import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Router } from 'express';

// Building the app loads every module; none touches the database here.
vi.mock('../database/prisma-client', () => ({ prisma: {} }));

import { API_ROUTES, createApp } from '../app';
import { openApiDocument, ROUTES } from './openapi';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Every "METHOD /api/v1/path" Express actually serves, in OpenAPI path syntax. */
function expressRoutes(): string[] {
  const found: string[] = [];
  for (const [prefix, router] of API_ROUTES) {
    for (const layer of (router as Router & { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const path = `/api/v1${prefix}${layer.route.path === '/' ? '' : layer.route.path}`.replace(/:(\w+)/g, '{$1}');
      for (const m of METHODS) if (layer.route.methods[m]) found.push(`${m.toUpperCase()} ${path}`);
    }
  }
  return found.sort();
}

function documentedRoutes(): string[] {
  const doc = openApiDocument();
  const found: string[] = [];
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const m of METHODS) if ((item as Record<string, unknown>)[m]) found.push(`${m.toUpperCase()} ${path}`);
  }
  return found.sort();
}

describe('OpenAPI documentation', () => {
  it('documents exactly the routes Express serves (no missing, no extra)', () => {
    expect(documentedRoutes()).toEqual(expressRoutes());
    expect(expressRoutes()).toHaveLength(ROUTES.length);
  });

  it('declares roles and error responses for every protected route', () => {
    const doc = openApiDocument();
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
      for (const m of METHODS) {
        const op = (item as Record<string, { security?: unknown[]; responses: Record<string, unknown>; description?: string }>)[m];
        if (!op) continue;
        const isPublic = (op.security ?? []).length === 0;
        if (!isPublic) {
          expect(op.responses, `${m} ${path}`).toHaveProperty('401');
          expect(op.responses, `${m} ${path}`).toHaveProperty('403');
          expect(op.description, `${m} ${path}`).toMatch(/\*\*Roles:\*\*/);
        }
      }
    }
  });

  it('documents request bodies from the real validation schemas', () => {
    const doc = openApiDocument();
    const createTrip = doc.paths?.['/api/v1/trips']?.post;
    const schema = (createTrip?.requestBody as { content: Record<string, { schema: { properties: Record<string, unknown>; required?: string[] } }> })
      .content['application/json']!.schema;
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['destination', 'departureAt']));
    expect(schema.required).toEqual(expect.arrayContaining(['destination', 'departureAt']));
  });

  it('serves the JSON spec and the Swagger UI', async () => {
    const app = createApp();
    const spec = await request(app).get('/api/v1/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe('3.0.3');

    const ui = await request(app).get('/api/v1/docs/');
    expect(ui.status).toBe(200);
    expect(ui.text).toContain('swagger-ui');
  });
});
