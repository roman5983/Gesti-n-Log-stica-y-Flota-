import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import {
  createDriver,
  createStaff,
  createVehicle,
  futureDeparture,
  tokenFor,
  prisma,
  resetDatabase,
} from './fixtures';

/**
 * The main business flow against the real database: create a trip, assign it
 * (the vehicle is chosen by the system) and finish it, with the effects on
 * the vehicle, the driver and the audit log.
 */

const app = createApp();
let operatorToken: string;
let operatorId: number;

beforeEach(async () => {
  await resetDatabase();
  const operator = await createStaff('OPERATOR');
  operatorId = operator.id;
  operatorToken = tokenFor(operator);
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createTrip(destination = 'Rosario, Santa Fe') {
  const res = await request(app)
    .post('/api/v1/trips')
    .set(auth(operatorToken))
    .send({ destination, departureAt: futureDeparture() });
  expect(res.status).toBe(201);
  return res.body.data as { id: number; status: string };
}

describe('trip lifecycle: create → assign → finish', () => {
  it('assigns the available vehicle with the lowest km and finishes with every effect applied', async () => {
    const driver = await createDriver();
    await createVehicle({ km: 90_000 });
    const lowKm = await createVehicle({ km: 20_000 });
    await createVehicle({ km: 5_000, insuranceExpiryDays: -1 }); // lowest km, but insurance expired

    const trip = await createTrip();
    expect(trip.status).toBe('PENDING_ASSIGNMENT');

    const assigned = await request(app)
      .post(`/api/v1/trips/${trip.id}/assign`)
      .set(auth(operatorToken))
      .send({ driverId: driver.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toMatchObject({
      status: 'IN_PROGRESS',
      driver: { id: driver.id },
      vehicle: { id: lowKm.id },
      departureKm: 20_000,
    });
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: lowKm.id } })).status).toBe('ON_TRIP');

    // RN-5: the arrival reading has to be above the departure one.
    const driverToken = tokenFor(driver);
    const tooLow = await request(app)
      .post(`/api/v1/trips/${trip.id}/finish`)
      .set(auth(driverToken))
      .send({ arrivalKm: 20_000 });
    expect(tooLow.status).toBe(422);

    const finished = await request(app)
      .post(`/api/v1/trips/${trip.id}/finish`)
      .set(auth(driverToken))
      .send({ arrivalKm: 20_350 });
    expect(finished.status).toBe(200);
    expect(finished.body.data).toMatchObject({ status: 'COMPLETED', arrivalKm: 20_350 });

    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: lowKm.id } });
    expect(vehicle).toMatchObject({ status: 'AVAILABLE', accumulatedKm: 20_350 });
    const driverRow = await prisma.driver.findUniqueOrThrow({ where: { userId: driver.id } });
    expect(driverRow.completedTrips).toBe(1);
    expect(Number(driverRow.avgKm)).toBe(350);

    const actions = (await prisma.auditLog.findMany({ where: { entity: 'TRIP', entityId: trip.id } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'ASSIGN', 'FINISH']));
  });

  it('refuses a driver without the complete documentation (RN-4)', async () => {
    const driver = await createDriver({ documents: 'none' });
    await createVehicle();
    const trip = await createTrip();

    const res = await request(app)
      .post(`/api/v1/trips/${trip.id}/assign`)
      .set(auth(operatorToken))
      .send({ driverId: driver.id });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/documentación completa/);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('PENDING_ASSIGNMENT');
  });

  it('refuses a driver whose license expired (RN-1)', async () => {
    const driver = await createDriver({ licenseExpiryDays: -1 });
    await createVehicle();
    const trip = await createTrip();

    const res = await request(app)
      .post(`/api/v1/trips/${trip.id}/assign`)
      .set(auth(operatorToken))
      .send({ driverId: driver.id });
    expect(res.status).toBe(422);
  });

  it('says there is no vehicle when every one is busy or uninsured', async () => {
    const driver = await createDriver();
    await createVehicle({ status: 'IN_WORKSHOP' });
    const trip = await createTrip();

    const res = await request(app)
      .post(`/api/v1/trips/${trip.id}/assign`)
      .set(auth(operatorToken))
      .send({ driverId: driver.id });
    expect(res.status).toBe(409);
  });

  it('with only uninsured vehicles available, says so (RN-SEGURO)', async () => {
    const driver = await createDriver();
    await createVehicle({ insuranceExpiryDays: -1 });
    const trip = await createTrip();

    const res = await request(app)
      .post(`/api/v1/trips/${trip.id}/assign`)
      .set(auth(operatorToken))
      .send({ driverId: driver.id });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/seguro vigente/);
  });

  it('only cancels and deletes pending trips', async () => {
    const driver = await createDriver();
    await createVehicle();
    const pending = await createTrip('Córdoba');
    const inProgress = await createTrip('Santa Fe');
    await request(app).post(`/api/v1/trips/${inProgress.id}/assign`).set(auth(operatorToken)).send({ driverId: driver.id });

    expect((await request(app).post(`/api/v1/trips/${inProgress.id}/cancel`).set(auth(operatorToken))).status).toBe(422);
    expect((await request(app).delete(`/api/v1/trips/${inProgress.id}`).set(auth(operatorToken))).status).toBe(422);

    const cancelled = await request(app).post(`/api/v1/trips/${pending.id}/cancel`).set(auth(operatorToken));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  });

  it('records the operator who created the trip', async () => {
    const trip = await createTrip();
    const row = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(row.operatorId).toBe(operatorId);
    expect(row.origin).toMatch(/Ciudad Industria/); // RN-21: fixed origin
  });
});

describe('permissions by role', () => {
  it('a driver only sees their own trips and cannot create one', async () => {
    const mine = await createDriver();
    const other = await createDriver();
    await createVehicle();
    await createVehicle();
    const t1 = await createTrip('Destino A');
    const t2 = await createTrip('Destino B');
    await request(app).post(`/api/v1/trips/${t1.id}/assign`).set(auth(operatorToken)).send({ driverId: mine.id });
    await request(app).post(`/api/v1/trips/${t2.id}/assign`).set(auth(operatorToken)).send({ driverId: other.id });

    const token = tokenFor(mine);
    const list = await request(app).get('/api/v1/trips').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((t: { id: number }) => t.id)).toEqual([t1.id]);

    expect((await request(app).get(`/api/v1/trips/${t2.id}`).set(auth(token))).status).toBe(403);
    const create = await request(app).post('/api/v1/trips').set(auth(token)).send({ destination: 'X', departureAt: futureDeparture() });
    expect(create.status).toBe(403);
  });

  it('an operator cannot reach admin-only endpoints', async () => {
    expect((await request(app).get('/api/v1/users').set(auth(operatorToken))).status).toBe(403);
    expect((await request(app).get('/api/v1/audit-logs').set(auth(operatorToken))).status).toBe(403);
  });

  it('without a token every protected endpoint answers 401', async () => {
    expect((await request(app).get('/api/v1/trips')).status).toBe(401);
    expect((await request(app).get('/api/v1/vehicles')).status).toBe(401);
  });
});
