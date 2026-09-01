/**
 * Integral database seed (F-1) — coherent sample data that exercises every
 * module: users (all roles), drivers with varied license states, a fleet in
 * different statuses, documents with varied expiries, maintenances (history
 * and in-progress) and trips (completed, in-progress, pending).
 *
 * Dates are relative to "today" so the alert evaluator and the reports have
 * meaningful data whenever the seed is run.
 *
 * Idempotent: catalog/users/drivers/vehicles are upserted by natural keys;
 * transactional sample data (documents, maintenances, trips) is cleared for
 * the sample entities and recreated, so the seed is safe to re-run.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/database/prisma-client';
import { encrypt } from '../src/shared/utils/crypto';
import { FIXED_TRIP_ORIGIN } from '../src/config/constants';

const BCRYPT_ROUNDS = 10;

/** Date offsets from today (UTC midnight), for readable relative dates. */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000);
}

async function seedCatalog(): Promise<void> {
  await prisma.maintenanceType.upsert({
    where: { name: 'Preventivo menor' },
    update: {},
    create: {
      name: 'Preventivo menor',
      description: 'Cambio de aceite, filtros y engrase',
      kmAlert: 10000,
      kmTarget: 20000,
      monthsAlert: 3,
      monthsTarget: 6,
    },
  });
  await prisma.maintenanceType.upsert({
    where: { name: 'Preventivo mayor' },
    update: {},
    create: {
      name: 'Preventivo mayor',
      description: 'Revisión de frenos, suspensión y alineación',
      kmAlert: 80000,
      kmTarget: 120000,
      monthsAlert: 12,
      monthsTarget: 12,
    },
  });

  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'Empresa de Servicios Logísticos',
      taxId: '30-00000000-0',
      address: 'Ciudad Industria, Rosario, Santa Fe',
      phone: '+54 341 000-0000',
      email: 'contacto@empresa.com',
    },
  });
}

interface SeededUser {
  id: number;
}

async function upsertUser(
  name: string,
  email: string,
  role: 'ADMIN' | 'OPERATOR' | 'DRIVER',
  password: string,
): Promise<SeededUser> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { name, email, passwordHash, role },
    select: { id: true },
  });
}

async function upsertDriver(
  user: SeededUser,
  dni: string,
  licenseCategory: 'A' | 'B' | 'C' | 'E',
  licenseExpiryDate: Date,
  password: string,
): Promise<number> {
  await prisma.driver.upsert({
    where: { userId: user.id },
    update: { dni, licenseCategory, licenseExpiryDate },
    create: {
      userId: user.id,
      dni,
      licenseCategory,
      licenseExpiryDate,
      encryptedPassword: encrypt(password),
    },
  });
  return user.id;
}

async function main(): Promise<void> {
  await seedCatalog();

  // --- Users: admin + operator ---
  const admin = await upsertUser('Administrador General', 'admin@empresa.com', 'ADMIN', 'Admin1234!');
  const operator = await upsertUser(
    'Operador de Logística',
    'operador@empresa.com',
    'OPERATOR',
    'Operator1234!',
  );

  // --- Drivers with varied license states ---
  const juanUser = await upsertUser('Juan Pérez', 'chofer@empresa.com', 'DRIVER', 'Driver1234!');
  const juanId = await upsertDriver(juanUser, '30123456', 'C', daysFromNow(400), 'Driver1234!');

  const mariaUser = await upsertUser('María Gómez', 'maria@empresa.com', 'DRIVER', 'Driver1234!');
  const mariaId = await upsertDriver(mariaUser, '28111222', 'B', daysFromNow(300), 'Driver1234!');

  const carlosUser = await upsertUser('Carlos Ruiz', 'carlos@empresa.com', 'DRIVER', 'Driver1234!');
  // License expiring within 10 days → LICENSE_EXPIRING alert.
  const carlosId = await upsertDriver(carlosUser, '32333444', 'C', daysFromNow(10), 'Driver1234!');

  const luciaUser = await upsertUser('Lucía Fernández', 'lucia@empresa.com', 'DRIVER', 'Driver1234!');
  // License expired 5 days ago → LICENSE_EXPIRED; not assignable (RN-1).
  await upsertDriver(luciaUser, '27555666', 'E', daysFromNow(-5), 'Driver1234!');

  // --- Fleet in different statuses ---
  const vAAA = await prisma.vehicle.upsert({
    where: { licensePlate: 'AAA111' },
    update: {},
    create: {
      licensePlate: 'AAA111',
      model: 'Mercedes-Benz Sprinter',
      year: 2021,
      initialKm: 0,
      accumulatedKm: 45000,
      lastMaintenanceDate: daysFromNow(-60),
      insuranceExpiryDate: daysFromNow(200),
      status: 'AVAILABLE',
    },
    select: { id: true },
  });
  const vBBB = await prisma.vehicle.upsert({
    where: { licensePlate: 'BBB222' },
    update: {},
    create: {
      licensePlate: 'BBB222',
      model: 'Iveco Daily',
      year: 2019,
      initialKm: 0,
      accumulatedKm: 95000, // 15000 km since last maintenance → MAINTENANCE_KM_EXCEEDED
      lastMaintenanceDate: daysFromNow(-120),
      insuranceExpiryDate: daysFromNow(7), // → INSURANCE_EXPIRING
      status: 'AVAILABLE',
    },
    select: { id: true },
  });
  const vCCC = await prisma.vehicle.upsert({
    where: { licensePlate: 'CCC333' },
    update: {},
    create: {
      licensePlate: 'CCC333',
      model: 'Ford Transit',
      year: 2018,
      initialKm: 0,
      accumulatedKm: 120000,
      insuranceExpiryDate: daysFromNow(-15), // → INSURANCE_EXPIRED
      status: 'INACTIVE', // → VEHICLE_INACTIVE
    },
    select: { id: true },
  });
  const vDDD = await prisma.vehicle.upsert({
    where: { licensePlate: 'DDD444' },
    update: {},
    create: {
      licensePlate: 'DDD444',
      model: 'Volkswagen Crafter',
      year: 2022,
      initialKm: 0,
      accumulatedKm: 30000,
      insuranceExpiryDate: daysFromNow(180),
      status: 'ON_TRIP', // carries María's in-progress trip
    },
    select: { id: true },
  });
  const vEEE = await prisma.vehicle.upsert({
    where: { licensePlate: 'EEE555' },
    update: {},
    create: {
      licensePlate: 'EEE555',
      model: 'Renault Master',
      year: 2020,
      initialKm: 0,
      accumulatedKm: 60000,
      insuranceExpiryDate: daysFromNow(150),
      status: 'IN_WORKSHOP', // has an in-progress maintenance
    },
    select: { id: true },
  });

  // --- Reset transactional sample data (idempotent re-run) ---
  const sampleDriverIds = [juanId, mariaId, carlosId, luciaUser.id];
  const sampleVehicleIds = [vAAA.id, vBBB.id, vCCC.id, vDDD.id, vEEE.id];
  await prisma.trip.deleteMany({
    where: { OR: [{ driverId: { in: sampleDriverIds } }, { operatorId: operator.id }] },
  });
  await prisma.maintenance.deleteMany({ where: { vehicleId: { in: sampleVehicleIds } } });
  await prisma.driverDocument.deleteMany({ where: { driverId: { in: sampleDriverIds } } });

  // --- Driver documents (varied expiries) ---
  const minorType = await prisma.maintenanceType.findUniqueOrThrow({
    where: { name: 'Preventivo menor' },
    select: { id: true },
  });

  await prisma.driverDocument.createMany({
    data: [
      docFor(juanId, 'DNI', daysFromNow(500)),
      docFor(juanId, 'LICENSE', daysFromNow(400)),
      docFor(juanId, 'ART', daysFromNow(12)), // → DOCUMENT_EXPIRING
      docFor(juanId, 'PSYCHOPHYSICAL', daysFromNow(220)),
      docFor(mariaId, 'DNI', daysFromNow(480)),
      docFor(mariaId, 'ART', daysFromNow(-3)), // → DOCUMENT_EXPIRED
    ],
  });

  // --- Maintenances: history + in-progress ---
  await prisma.maintenance.create({
    data: {
      vehicleId: vAAA.id,
      maintenanceTypeId: minorType.id,
      status: 'COMPLETED',
      scheduledAt: daysFromNow(-62),
      completedAt: daysFromNow(-60),
      km: 40000,
      notes: 'Service de rutina',
      nextMaintenanceKm: 50000,
    },
  });
  await prisma.maintenance.create({
    data: {
      vehicleId: vBBB.id,
      maintenanceTypeId: minorType.id,
      status: 'COMPLETED',
      scheduledAt: daysFromNow(-122),
      completedAt: daysFromNow(-120),
      km: 80000,
      nextMaintenanceKm: 90000,
    },
  });
  await prisma.maintenance.create({
    data: {
      vehicleId: vEEE.id,
      maintenanceTypeId: minorType.id,
      status: 'IN_PROGRESS', // vehicle EEE555 is IN_WORKSHOP
      scheduledAt: hoursAgo(6),
      km: 60000,
      notes: 'Cambio de correa',
    },
  });

  // --- Trips: completed (for reports), in-progress, pending ---
  // Completed trips this month (finishedAt recent) with km driven.
  await prisma.trip.create({
    data: completedTrip(operator.id, juanId, vAAA.id, 'Córdoba', 44500, 45000, 30, 26),
  });
  await prisma.trip.create({
    data: completedTrip(operator.id, juanId, vAAA.id, 'Santa Fe', 44000, 44500, 12, 20),
  });
  await prisma.trip.create({
    data: completedTrip(operator.id, mariaId, vBBB.id, 'Buenos Aires', 94000, 95000, 48, 40),
  });
  // Keep denormalized driver stats coherent with the completed trips above.
  await prisma.driver.update({ where: { userId: juanId }, data: { completedTrips: 2, avgKm: 500 } });
  await prisma.driver.update({ where: { userId: mariaId }, data: { completedTrips: 1, avgKm: 1000 } });

  // In-progress trip: María + DDD444 (vehicle ON_TRIP, driver busy).
  await prisma.trip.create({
    data: {
      origin: FIXED_TRIP_ORIGIN,
      destination: 'Mendoza',
      departureAt: hoursAgo(3),
      status: 'IN_PROGRESS',
      estimatedDistanceKm: 700,
      estimatedTimeMin: 600,
      operatorId: operator.id,
      driverId: mariaId,
      vehicleId: vDDD.id,
      departureKm: 30000,
      assignedAt: hoursAgo(3),
    },
  });

  // Pending-assignment trip (editable/deletable, no resources yet).
  await prisma.trip.create({
    data: {
      origin: FIXED_TRIP_ORIGIN,
      destination: 'Rosario Centro',
      departureAt: daysFromNow(1),
      status: 'PENDING_ASSIGNMENT',
      estimatedDistanceKm: 15,
      estimatedTimeMin: 25,
      operatorId: operator.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    'Seed completed: 2 maintenance types, settings, 6 users (1 admin, 1 operator, 4 drivers), ' +
      '5 vehicles, 6 documents, 3 maintenances, 5 trips. ' +
      'Run POST /api/v1/alerts/evaluate to generate the sample alerts.',
  );
}

function docFor(driverId: number, documentType: 'DNI' | 'LICENSE' | 'ART' | 'PSYCHOPHYSICAL', expiryDate: Date) {
  return {
    driverId,
    documentType,
    expiryDate,
    fileName: `${documentType.toLowerCase()}.pdf`,
    filePath: `uploads/documents/sample-${driverId}-${documentType.toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 1024,
  };
}

function completedTrip(
  operatorId: number,
  driverId: number,
  vehicleId: number,
  destination: string,
  departureKm: number,
  arrivalKm: number,
  hoursAgoDeparture: number,
  hoursAgoFinish: number,
) {
  return {
    origin: FIXED_TRIP_ORIGIN,
    destination,
    departureAt: hoursAgo(hoursAgoDeparture),
    status: 'COMPLETED' as const,
    estimatedDistanceKm: arrivalKm - departureKm,
    estimatedTimeMin: (arrivalKm - departureKm) * 1,
    operatorId,
    driverId,
    vehicleId,
    departureKm,
    arrivalKm,
    assignedAt: hoursAgo(hoursAgoDeparture),
    finishedAt: hoursAgo(hoursAgoFinish),
    finishedById: driverId,
  };
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
