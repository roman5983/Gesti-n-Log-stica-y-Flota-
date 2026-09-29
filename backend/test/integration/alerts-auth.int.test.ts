import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { createDriver, createStaff, createVehicle, PASSWORD, prisma, resetDatabase, tokenFor } from './fixtures';

const app = createApp();
let adminToken: string;
let adminEmail: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  await resetDatabase();
  const admin = await createStaff('ADMIN');
  adminEmail = admin.email;
  adminToken = tokenFor(admin);
});

describe('alert evaluation against the database', () => {
  it('raises the expected alerts and a second pass creates no duplicates', async () => {
    await createDriver({ licenseExpiryDays: 5 }); // LICENSE_EXPIRING
    await createDriver({ licenseExpiryDays: -3 }); // LICENSE_EXPIRED
    await createVehicle({ insuranceExpiryDays: -1 }); // INSURANCE_EXPIRED

    const first = await request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken));
    expect(first.status).toBe(200);
    const types = (await prisma.alert.findMany({ where: { status: 'PENDING' } })).map((a) => a.alertType).sort();
    expect(types).toEqual(['INSURANCE_EXPIRED', 'LICENSE_EXPIRED', 'LICENSE_EXPIRING']);

    const second = await request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken));
    expect(second.body.data.created).toBe(0);
    expect(await prisma.alert.count({ where: { status: 'PENDING' } })).toBe(3);
  });

  it('two evaluations at the same time do not duplicate alerts (GET_LOCK)', async () => {
    await createDriver({ licenseExpiryDays: -3 });
    await createVehicle({ insuranceExpiryDays: -1 });

    const results = await Promise.all([
      request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken)),
      request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken)),
    ]);
    for (const r of results) expect([200, 409]).toContain(r.status);

    const pending = await prisma.alert.findMany({ where: { status: 'PENDING' } });
    const keys = pending.map((a) => `${a.alertType}:${a.entityType}:${a.entityId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(2);
  });

  it('a resolved condition is auto-resolved on the next pass', async () => {
    const vehicle = await createVehicle({ insuranceExpiryDays: -1 });
    await request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken));
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { insuranceExpiryDate: new Date(Date.now() + 90 * 86_400_000) } });

    const res = await request(app).post('/api/v1/alerts/evaluate').set(auth(adminToken));
    expect(res.body.data.autoResolved).toBe(1);
    expect(await prisma.alert.count({ where: { status: 'PENDING' } })).toBe(0);
  });
});

describe('sessions and audit against the database', () => {
  it('login, refresh with the cookie and logout, with LOGIN/LOGOUT in the audit log', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/v1/auth/login').send({ email: adminEmail, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.headers['set-cookie']?.[0]).toMatch(/refresh_token=.*HttpOnly/i);

    const refreshed = await agent.post('/api/v1/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));

    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);

    const actions = (await prisma.auditLog.findMany({ where: { entity: 'USER' } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'LOGOUT']));
  });

  it('a reused (already rotated) refresh token revokes every session of the user', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/v1/auth/login').send({ email: adminEmail, password: PASSWORD });
    const oldCookie = loginRes.headers['set-cookie']![0]!.split(';')[0]!;
    await agent.post('/api/v1/auth/refresh'); // rotates: the old token is now revoked

    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401); // the new one died too
  });

  it('wrong password and unknown account answer the same 401', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: 'otra-cosa1' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nadie@test.local', password: 'otra-cosa1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
});
