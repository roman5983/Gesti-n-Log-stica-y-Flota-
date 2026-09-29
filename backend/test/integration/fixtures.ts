import { afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type request from 'supertest';
import { prisma } from '../../src/database/prisma-client';
import { env } from '../../src/config/env';
import { encrypt } from '../../src/shared/utils/crypto';
import { utcStartOfToday } from '../../src/shared/utils/dates';
import { REQUIRED_DRIVER_DOCUMENT_TYPES } from '../../src/config/constants';

/** Low bcrypt cost: these are throwaway test accounts and speed matters. */
const HASH_ROUNDS = 4;
export const PASSWORD = 'Test1234!';

const DAY_MS = 24 * 60 * 60 * 1000;
export const daysFromToday = (days: number): Date => new Date(utcStartOfToday().getTime() + days * DAY_MS);

/** A departure a few days ahead: always valid for "not before today". */
export const futureDeparture = (): string => new Date(Date.now() + 3 * DAY_MS).toISOString();

/**
 * Empties every table, children first so no foreign key complains. Each test
 * file starts from here and builds only the data it needs.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.maintenanceAttachment.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.driverDocument.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.maintenanceType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySettings.deleteMany();
}

let seq = 0;
const next = (): number => ++seq;

export async function createStaff(role: 'ADMIN' | 'OPERATOR', name = role === 'ADMIN' ? 'Ana Admin' : 'Oscar Operador') {
  return prisma.user.create({
    data: {
      name,
      email: `${role.toLowerCase()}${next()}@test.local`,
      passwordHash: await bcrypt.hash(PASSWORD, HASH_ROUNDS),
      role,
    },
  });
}

interface DriverOptions {
  name?: string;
  /** 'complete' = the four RN-4 documents, valid; 'none' = no documents. */
  documents?: 'complete' | 'none';
  licenseExpiryDays?: number;
}

export async function createDriver({ name = 'Chofer', documents = 'complete', licenseExpiryDays = 365 }: DriverOptions = {}) {
  const n = next();
  const user = await prisma.user.create({
    data: {
      name: `${name} ${n}`,
      email: `chofer${n}@test.local`,
      passwordHash: await bcrypt.hash(PASSWORD, HASH_ROUNDS),
      role: 'DRIVER',
      driver: {
        create: {
          dni: String(30_000_000 + n),
          licenseCategory: 'C',
          licenseExpiryDate: daysFromToday(licenseExpiryDays),
          encryptedPassword: encrypt(PASSWORD),
        },
      },
    },
  });
  if (documents === 'complete') {
    const content = Buffer.from('%PDF-1.4 test');
    await prisma.driverDocument.createMany({
      data: REQUIRED_DRIVER_DOCUMENT_TYPES.map((documentType) => ({
        driverId: user.id,
        documentType,
        expiryDate: daysFromToday(180),
        fileName: `${documentType.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        fileSize: content.byteLength,
        content,
      })),
    });
  }
  return user;
}

interface VehicleOptions {
  km?: number;
  insuranceExpiryDays?: number;
  status?: 'AVAILABLE' | 'INACTIVE' | 'IN_WORKSHOP' | 'ON_TRIP';
}

export async function createVehicle({ km = 10_000, insuranceExpiryDays = 180, status = 'AVAILABLE' }: VehicleOptions = {}) {
  const n = next();
  return prisma.vehicle.create({
    data: {
      licensePlate: `TT${String(n).padStart(3, '0')}AA`,
      model: 'Iveco Daily',
      year: 2022,
      initialKm: km,
      accumulatedKm: km,
      insuranceExpiryDate: daysFromToday(insuranceExpiryDays),
      status,
    },
  });
}

/**
 * An access token for a test user, signed like the real login does. The
 * tests use this instead of POST /auth/login because the login is limited to
 * 10 attempts per 15 minutes per IP (and every request here comes from the
 * same one). The login itself is tested on its own in alerts-auth.int.test.ts.
 */
export function tokenFor(user: { id: number; role: 'ADMIN' | 'OPERATOR' | 'DRIVER' }): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

/** Runs the requests at the same time and returns their status codes, sorted. */
export async function concurrently(requests: Promise<request.Response>[]): Promise<number[]> {
  const responses = await Promise.all(requests);
  return responses.map((r) => r.status).sort((a, b) => a - b);
}

// Close the connection pool at the end of each file so the run ends cleanly.
afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
