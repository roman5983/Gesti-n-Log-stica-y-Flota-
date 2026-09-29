import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import {
  concurrently,
  createDriver,
  createStaff,
  createVehicle,
  futureDeparture,
  tokenFor,
  prisma,
  resetDatabase,
} from './fixtures';

/**
 * The races of manual chapter 23, fired for real: two requests at the same
 * time against MySQL. The unit tests can only simulate them with mocks; here
 * the row locks (SELECT … FOR UPDATE) are what keeps the data consistent.
 *
 * Each case checks the HTTP answers AND the final state of the database:
 * whichever request wins, the invariant must hold.
 */

const app = createApp();
let adminToken: string;
let operatorToken: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const ROUNDS = 5;

beforeEach(async () => {
  await resetDatabase();
  const admin = await createStaff('ADMIN');
  const operator = await createStaff('OPERATOR');
  adminToken = tokenFor(admin);
  operatorToken = tokenFor(operator);
});

async function createTrip(): Promise<number> {
  const res = await request(app)
    .post('/api/v1/trips')
    .set(auth(operatorToken))
    .send({ destination: 'Rosario, Santa Fe', departureAt: futureDeparture() });
  return res.body.data.id as number;
}

const assign = (tripId: number, driverId: number) =>
  request(app).post(`/api/v1/trips/${tripId}/assign`).set(auth(operatorToken)).send({ driverId });

describe('concurrency (manual, chapter 23)', () => {
  it('two assignments of the same trip: exactly one wins and only one vehicle leaves', async () => {
    const [d1, d2] = [await createDriver(), await createDriver()];
    await createVehicle();
    await createVehicle();
    const tripId = await createTrip();

    const statuses = await concurrently([assign(tripId, d1.id), assign(tripId, d2.id)]);
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);

    expect(await prisma.vehicle.count({ where: { status: 'ON_TRIP' } })).toBe(1);
    expect(await prisma.trip.count({ where: { status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('the same driver on two trips at once: only one assignment goes through (RN-19)', async () => {
    const driver = await createDriver();
    await createVehicle();
    await createVehicle();
    const [t1, t2] = [await createTrip(), await createTrip()];

    const statuses = await concurrently([assign(t1, driver.id), assign(t2, driver.id)]);
    expect(statuses).toEqual([200, 409]);
    expect(await prisma.trip.count({ where: { driverId: driver.id, status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('two trips and a single vehicle: the vehicle is not handed out twice', async () => {
    const [d1, d2] = [await createDriver(), await createDriver()];
    await createVehicle();
    const [t1, t2] = [await createTrip(), await createTrip()];

    const statuses = await concurrently([assign(t1, d1.id), assign(t2, d2.id)]);
    expect(statuses).toEqual([200, 409]);
    expect(await prisma.trip.count({ where: { status: 'IN_PROGRESS' } })).toBe(1);
  });

  it('driver and operator finish the same trip at once: it is counted once', async () => {
    const driver = await createDriver();
    const vehicle = await createVehicle({ km: 1_000 });
    const tripId = await createTrip();
    await assign(tripId, driver.id);
    const driverToken = tokenFor(driver);

    const finish = (token: string) =>
      request(app).post(`/api/v1/trips/${tripId}/finish`).set(auth(token)).send({ arrivalKm: 1_200 });
    const statuses = await concurrently([finish(driverToken), finish(operatorToken)]);
    expect(statuses).toEqual([200, 422]);

    expect((await prisma.driver.findUniqueOrThrow({ where: { userId: driver.id } })).completedTrips).toBe(1);
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).accumulatedKm).toBe(1_200);
  });

  it('deactivating the only vehicle while it is being assigned never leaves an inactive vehicle on a trip', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await prisma.trip.deleteMany();
      await prisma.vehicle.deleteMany();
      const driver = await createDriver();
      const vehicle = await createVehicle();
      const tripId = await createTrip();

      const [assignRes, deactivateRes] = await Promise.all([
        assign(tripId, driver.id),
        request(app).post(`/api/v1/vehicles/${vehicle.id}/deactivate`).set(auth(adminToken)),
      ]);
      // One of the two wins; the other is refused with a reason.
      expect([assignRes.status, deactivateRes.status].filter((s) => s === 200)).toHaveLength(1);

      const v = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
      const onTrip = await prisma.trip.count({ where: { vehicleId: vehicle.id, status: 'IN_PROGRESS' } });
      expect(v.status === 'INACTIVE' && onTrip > 0, `ronda ${round}: vehículo inactivo en viaje`).toBe(false);
    }
  });

  it('deleting a driver while it is being assigned never leaves a deleted driver on a trip', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      await prisma.trip.deleteMany();
      await prisma.vehicle.updateMany({ data: { status: 'AVAILABLE' } });
      const driver = await createDriver();
      await createVehicle();
      const tripId = await createTrip();

      await Promise.all([
        assign(tripId, driver.id),
        request(app).delete(`/api/v1/users/${driver.id}`).set(auth(adminToken)),
      ]);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: driver.id } });
      const onTrip = await prisma.trip.count({ where: { driverId: driver.id, status: 'IN_PROGRESS' } });
      expect(user.deletedAt !== null && onTrip > 0, `ronda ${round}: chofer eliminado en viaje`).toBe(false);
    }
  });

  it('two vehicles with the same plate at once: one is created, the other gets 409', async () => {
    const body = { licensePlate: 'AB123CD', model: 'Iveco Daily', year: 2022, initialKm: 0 };
    const create = () => request(app).post('/api/v1/vehicles').set(auth(adminToken)).send(body);

    const statuses = await concurrently([create(), create()]);
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.vehicle.count({ where: { licensePlate: 'AB123CD' } })).toBe(1);
  });
});
