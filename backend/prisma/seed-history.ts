/**
 * Demo history generator for the seed — about 200 days of fleet operation, so
 * the system looks like it has been in use for months instead of starting
 * almost empty (dashboard chart, reports, audit trail, resolved alerts).
 *
 * PURE: no Prisma, no I/O, no Math.random. Everything derives from `now` and a
 * fixed PRNG seed, so the same code always produces the same history (shifted
 * to the day it runs). That is what lets seed-history.test.ts check the
 * business rules on the generated data without a database: no driver or
 * vehicle on two things at once, odometer chains that add up, nobody driving
 * with an expired license or insurance, the exact set of alerts the evaluator
 * should find afterwards, etc. seed.ts only writes this plan to MySQL.
 *
 * Snapshots in the audit rows use the SAME shapes the services record
 * (toAuditSnapshot & co.), so the Auditoría screen renders them exactly like
 * entries produced by real use.
 */
import { EXPIRY_ALERT_LEAD_DAYS } from '../src/config/constants';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Argentina has no DST: local time is always UTC-3. */
const ART_OFFSET_MS = 3 * HOUR_MS;

/** First day of simulated operation (relative to today). */
export const START_DAY = -200;

/** Every completed trip must be over at least this long before `now`. */
const LAST_FINISH_MARGIN_MS = 8 * HOUR_MS;

/** Preventive policy: a vehicle is serviced before exceeding this many km. */
export const MAINTENANCE_POLICY_KM = 9000;
/** Catalog threshold used by the evaluator (lowest km_alert, "Preventivo menor"). */
export const KM_ALERT_THRESHOLD = 10000;

// ---------------------------------------------------------------------------
// Static demo data
// ---------------------------------------------------------------------------

export type ActorKey = 'admin' | 'op1' | 'op2' | DriverKey;
export type OperatorKey = 'op1' | 'op2';
export type DriverKey = 'juan' | 'maria' | 'carlos' | 'lucia' | 'valentina' | 'diego' | 'roberto';
export type VehicleKey = 'AAA111' | 'BBB222' | 'CCC333' | 'DDD444' | 'EEE555' | 'FFF666' | 'GGG777' | 'HHH888';
export type DocType = 'DNI' | 'LICENSE' | 'ART' | 'PSYCHOPHYSICAL';

export interface StaffDef {
  key: 'admin' | OperatorKey;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  password: string;
  joinedDay: number;
}

export const STAFF: StaffDef[] = [
  { key: 'admin', name: 'Administrador General', email: 'admin@empresa.com', role: 'ADMIN', password: 'Admin1234!', joinedDay: -240 },
  { key: 'op1', name: 'Operador de Logística', email: 'operador@empresa.com', role: 'OPERATOR', password: 'Operator1234!', joinedDay: -235 },
  { key: 'op2', name: 'Sofía Martínez', email: 'sofia@empresa.com', role: 'OPERATOR', password: 'Operator1234!', joinedDay: -150 },
];

export interface DriverDef {
  key: DriverKey;
  name: string;
  email: string;
  dni: string;
  licenseCategory: 'A' | 'B' | 'C' | 'E';
  /** Current license expiry, in days from today. */
  licenseDays: number;
  joinedDay: number;
  /** Last day the driver can take a trip (license expired / dismissed after it). */
  lastTripDay?: number;
  /** Days on which assignment was blocked (RN-4: expired documentation). */
  blocked?: [number, number][];
  active: boolean;
}

export const DRIVER_PASSWORD = 'Driver1234!';

export const DRIVERS: DriverDef[] = [
  { key: 'juan', name: 'Juan Pérez', email: 'chofer@empresa.com', dni: '30123456', licenseCategory: 'C', licenseDays: 400, joinedDay: -230, active: true },
  { key: 'maria', name: 'María Gómez', email: 'maria@empresa.com', dni: '28111222', licenseCategory: 'B', licenseDays: 300, joinedDay: -230, active: true },
  // License expiring within 10 days → LICENSE_EXPIRING.
  { key: 'carlos', name: 'Carlos Ruiz', email: 'carlos@empresa.com', dni: '32333444', licenseCategory: 'C', licenseDays: 10, joinedDay: -230, active: true },
  // License expired 5 days ago → LICENSE_EXPIRED, not assignable (RN-1).
  { key: 'lucia', name: 'Lucía Fernández', email: 'lucia@empresa.com', dni: '27555666', licenseCategory: 'E', licenseDays: -5, joinedDay: -230, lastTripDay: -6, active: true },
  { key: 'valentina', name: 'Valentina Ríos', email: 'valentina@empresa.com', dni: '35777888', licenseCategory: 'C', licenseDays: 500, joinedDay: -210, active: true },
  // Joined later; DNI expired for a few days before being replaced (RN-4 block).
  { key: 'diego', name: 'Diego Sosa', email: 'diego@empresa.com', dni: '38999000', licenseCategory: 'B', licenseDays: 250, joinedDay: -120, blocked: [[-22, -18]], active: true },
  // License expired and never renewed → dismissed (baja). Shows as "Inactivo".
  { key: 'roberto', name: 'Roberto Díaz', email: 'roberto@empresa.com', dni: '25444555', licenseCategory: 'C', licenseDays: -62, joinedDay: -230, lastTripDay: -63, active: false },
];

export type VehicleStatus = 'AVAILABLE' | 'INACTIVE' | 'IN_WORKSHOP' | 'ON_TRIP';

export interface VehicleDef {
  plate: VehicleKey;
  model: string;
  year: number;
  /** Odometer when the vehicle was registered in the system (= initialKm). */
  startKm: number;
  joinedDay: number;
  /** Current insurance expiry, in days from today. */
  insuranceDays: number;
  /** Relative selection weight for trips (workhorse > 1). */
  weight: number;
  lastTripDay?: number;
  /** Days on which the vehicle could not be assigned (insurance lapsed). */
  blocked?: [number, number][];
  finalStatus: VehicleStatus;
}

export const VEHICLES: VehicleDef[] = [
  { plate: 'AAA111', model: 'Mercedes-Benz Sprinter', year: 2021, startKm: 18000, joinedDay: -232, insuranceDays: 200, weight: 1, finalStatus: 'AVAILABLE' },
  // Workhorse, overdue for service → MAINTENANCE_KM_EXCEEDED; insurance → INSURANCE_EXPIRING.
  { plate: 'BBB222', model: 'Iveco Daily', year: 2019, startKm: 52000, joinedDay: -232, insuranceDays: 7, weight: 1.6, finalStatus: 'AVAILABLE' },
  // Retired 40 days ago → VEHICLE_INACTIVE; its insurance then lapsed → INSURANCE_EXPIRED.
  { plate: 'CCC333', model: 'Ford Transit', year: 2018, startKm: 96000, joinedDay: -232, insuranceDays: -15, weight: 0.8, lastTripDay: -46, finalStatus: 'INACTIVE' },
  // Carries María's in-progress trip.
  { plate: 'DDD444', model: 'Volkswagen Crafter', year: 2022, startKm: 6000, joinedDay: -232, insuranceDays: 180, weight: 1, finalStatus: 'ON_TRIP' },
  // In the workshop right now.
  { plate: 'EEE555', model: 'Renault Master', year: 2020, startKm: 31000, joinedDay: -232, insuranceDays: 150, weight: 1, finalStatus: 'IN_WORKSHOP' },
  // Joined the fleet later.
  { plate: 'FFF666', model: 'Toyota Hilux', year: 2023, startKm: 12000, joinedDay: -150, insuranceDays: 300, weight: 0.9, finalStatus: 'AVAILABLE' },
  // Insurance lapsed for three days before being renewed (not assignable then).
  { plate: 'GGG777', model: 'Fiat Ducato', year: 2020, startKm: 41000, joinedDay: -232, insuranceDays: 275, weight: 1, blocked: [[-90, -88]], finalStatus: 'AVAILABLE' },
  { plate: 'HHH888', model: 'Peugeot Boxer', year: 2021, startKm: 24000, joinedDay: -232, insuranceDays: 340, weight: 1, finalStatus: 'AVAILABLE' },
];

/** Round-trip km from the fixed origin (Rosario), with a frequency weight. */
const DESTINATIONS: { name: string; km: number; weight: number }[] = [
  { name: 'San Lorenzo', km: 50, weight: 3 },
  { name: 'Villa Constitución', km: 110, weight: 3 },
  { name: 'Casilda', km: 110, weight: 3 },
  { name: 'San Nicolás', km: 140, weight: 4 },
  { name: 'Cañada de Gómez', km: 140, weight: 3 },
  { name: 'Firmat', km: 180, weight: 2 },
  { name: 'Pergamino', km: 240, weight: 3 },
  { name: 'Marcos Juárez', km: 260, weight: 2 },
  { name: 'Venado Tuerto', km: 330, weight: 3 },
  { name: 'Santa Fe', km: 340, weight: 5 },
  { name: 'Paraná', km: 360, weight: 3 },
  { name: 'Junín', km: 400, weight: 2 },
  { name: 'Rafaela', km: 460, weight: 2 },
  { name: 'Villa María', km: 500, weight: 2 },
  { name: 'Buenos Aires', km: 600, weight: 6 },
  { name: 'Río Cuarto', km: 760, weight: 2 },
  { name: 'Córdoba', km: 800, weight: 5 },
  { name: 'Mendoza', km: 1740, weight: 1 },
];

const TRIP_NOTES = [
  'Entrega urgente',
  'Carga paletizada',
  'Retiro de mercadería en depósito',
  'Coordinar descarga con el cliente',
  'Carga frágil',
];

const MAINTENANCE_NOTES = [
  'Service de rutina',
  'Cambio de aceite y filtros',
  'Revisión general',
  'Cambio de pastillas de freno',
  'Alineación y balanceo',
];

export interface DocDef {
  key: string;
  driver: DriverKey;
  type: DocType;
  expiryDays: number;
  uploadedDay: number;
  /** Replaced by a newer document on this day (soft delete). */
  deletedDay?: number;
}

export const DOCUMENTS: DocDef[] = [
  { key: 'juan-dni', driver: 'juan', type: 'DNI', expiryDays: 500, uploadedDay: -229 },
  { key: 'juan-license', driver: 'juan', type: 'LICENSE', expiryDays: 400, uploadedDay: -60 },
  { key: 'juan-art', driver: 'juan', type: 'ART', expiryDays: 12, uploadedDay: -229 }, // → DOCUMENT_EXPIRING
  { key: 'juan-psy', driver: 'juan', type: 'PSYCHOPHYSICAL', expiryDays: 220, uploadedDay: -229 },
  { key: 'maria-dni', driver: 'maria', type: 'DNI', expiryDays: 480, uploadedDay: -229 },
  { key: 'maria-license', driver: 'maria', type: 'LICENSE', expiryDays: 300, uploadedDay: -140 },
  { key: 'maria-art', driver: 'maria', type: 'ART', expiryDays: 5, uploadedDay: -229 }, // → DOCUMENT_EXPIRING
  { key: 'maria-psy', driver: 'maria', type: 'PSYCHOPHYSICAL', expiryDays: 150, uploadedDay: -229 },
  { key: 'carlos-dni', driver: 'carlos', type: 'DNI', expiryDays: 610, uploadedDay: -229 },
  { key: 'carlos-license', driver: 'carlos', type: 'LICENSE', expiryDays: 10, uploadedDay: -229 }, // → DOCUMENT_EXPIRING
  { key: 'carlos-art', driver: 'carlos', type: 'ART', expiryDays: 90, uploadedDay: -229 },
  { key: 'carlos-psy-old', driver: 'carlos', type: 'PSYCHOPHYSICAL', expiryDays: -40, uploadedDay: -229, deletedDay: -45 },
  { key: 'carlos-psy', driver: 'carlos', type: 'PSYCHOPHYSICAL', expiryDays: 320, uploadedDay: -45 },
  { key: 'lucia-dni', driver: 'lucia', type: 'DNI', expiryDays: 560, uploadedDay: -229 },
  { key: 'lucia-license', driver: 'lucia', type: 'LICENSE', expiryDays: -5, uploadedDay: -229 }, // → DOCUMENT_EXPIRED
  { key: 'lucia-psy', driver: 'lucia', type: 'PSYCHOPHYSICAL', expiryDays: 200, uploadedDay: -229 },
  { key: 'valentina-dni', driver: 'valentina', type: 'DNI', expiryDays: 800, uploadedDay: -209 },
  { key: 'valentina-license', driver: 'valentina', type: 'LICENSE', expiryDays: 500, uploadedDay: -209 },
  { key: 'valentina-art', driver: 'valentina', type: 'ART', expiryDays: 200, uploadedDay: -209 },
  { key: 'valentina-psy', driver: 'valentina', type: 'PSYCHOPHYSICAL', expiryDays: 100, uploadedDay: -209 },
  { key: 'diego-dni-old', driver: 'diego', type: 'DNI', expiryDays: -22, uploadedDay: -119, deletedDay: -18 },
  { key: 'diego-dni', driver: 'diego', type: 'DNI', expiryDays: 3000, uploadedDay: -18 },
  { key: 'diego-license', driver: 'diego', type: 'LICENSE', expiryDays: 250, uploadedDay: -119 },
  { key: 'diego-art', driver: 'diego', type: 'ART', expiryDays: 60, uploadedDay: -119 },
  { key: 'roberto-dni', driver: 'roberto', type: 'DNI', expiryDays: 400, uploadedDay: -229 },
  { key: 'roberto-license', driver: 'roberto', type: 'LICENSE', expiryDays: -62, uploadedDay: -229 },
];

const DOC_LABELS: Record<DocType, string> = {
  DNI: 'DNI',
  LICENSE: 'Licencia de conducir',
  ART: 'ART',
  PSYCHOPHYSICAL: 'Psicofísico',
};

export const COMPANY_SETTINGS = {
  companyName: 'Empresa de Servicios Logísticos',
  taxId: '30-00000000-0',
  address: 'Ciudad Industria, Rosario, Santa Fe',
  phone: '+54 341 456-7890',
  email: 'contacto@empresa.com',
  timezone: 'America/Argentina/Cordoba',
  language: 'es-AR',
  dateFormat: 'DD/MM/YYYY',
};
const PREVIOUS_PHONE = '+54 341 000-0000';
const SETTINGS_CHANGED_DAY = -100;

// ---------------------------------------------------------------------------
// Clock & PRNG
// ---------------------------------------------------------------------------

export interface Clock {
  now: Date;
  /** Local (ART) wall-clock time on a relative day: at(-3, 9.5) = 3 days ago, 09:30. */
  at(day: number, hour: number): Date;
  /** Date-only value (UTC midnight), as Prisma returns `@db.Date` columns. */
  dateOnly(day: number): Date;
  /** Relative day (local calendar) of an instant. */
  dayOf(t: Date): number;
}

export function makeClock(now: Date): Clock {
  const local = new Date(now.getTime() - ART_OFFSET_MS);
  const todayStart =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + ART_OFFSET_MS;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    now,
    at: (day, hour) => new Date(todayStart + day * DAY_MS + Math.round(hour * HOUR_MS)),
    dateOnly: (day) => new Date(todayUtc + day * DAY_MS),
    dayOf: (t) => Math.floor((t.getTime() - todayStart) / DAY_MS),
  };
}

/** mulberry32: tiny, fast, good enough for demo data, fully reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T extends { weight: number }>(items: T[], r: number): T | undefined {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  for (const item of items) {
    acc += item.weight / total;
    if (r < acc) return item;
  }
  return items[items.length - 1];
}

function inWindows(day: number, windows?: [number, number][]): boolean {
  return (windows ?? []).some(([from, to]) => day >= from && day <= to);
}

// ---------------------------------------------------------------------------
// History model
// ---------------------------------------------------------------------------

export type TripStatus = 'PENDING_ASSIGNMENT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PlannedTrip {
  destination: string;
  departureAt: Date;
  createdAt: Date;
  createdBy: OperatorKey;
  status: TripStatus;
  estimatedDistanceKm: number;
  estimatedTimeMin: number;
  notes: string | null;
  driver: DriverKey | null;
  vehicle: VehicleKey | null;
  assignedAt: Date | null;
  departureKm: number | null;
  arrivalKm: number | null;
  finishedAt: Date | null;
  finishedBy: ActorKey | null;
  cancelledAt: Date | null;
  /** Internal: odometer km actually driven (completed trips). */
  distance: number;
}

export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface PlannedMaintenance {
  vehicle: VehicleKey;
  type: 'minor' | 'major';
  status: MaintenanceStatus;
  createdAt: Date;
  createdBy: OperatorKey;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  km: number;
  nextMaintenanceKm: number | null;
  notes: string | null;
}

export type AlertEntity =
  | { kind: 'vehicle'; key: VehicleKey }
  | { kind: 'driver'; key: DriverKey }
  | { kind: 'document'; key: string };

export interface PlannedAlert {
  alertType: string;
  entity: AlertEntity;
  description: string;
  raisedAt: Date;
  resolvedAt: Date;
  /** manual → an admin clicked "resolver" (RESOLVE); auto → the evaluator reconciled it. */
  resolution: 'manual' | 'auto';
}

/** An edit to a driver or vehicle outside trips/maintenances (renewals, dismissals). */
export type PlannedChange =
  | { kind: 'driverLicense'; driver: DriverKey; at: Date; previousDays: number; newDays: number }
  | { kind: 'vehicleInsurance'; vehicle: VehicleKey; at: Date; previousDays: number; newDays: number }
  | { kind: 'vehicleDeactivate'; vehicle: VehicleKey; at: Date }
  | { kind: 'userDeactivate'; user: DriverKey; at: Date }
  | { kind: 'viewCredentials'; driver: DriverKey; at: Date }
  | { kind: 'companySettings'; at: Date };

export interface History {
  clock: Clock;
  trips: PlannedTrip[];
  maintenances: PlannedMaintenance[];
  alerts: PlannedAlert[];
  changes: PlannedChange[];
  vehicleFinal: Record<VehicleKey, { km: number; lastMaintenanceDate: Date | null }>;
  driverStats: Record<DriverKey, { completedTrips: number; avgKm: number }>;
  kmAt(vehicle: VehicleKey, t: Date): number;
  statusAt(vehicle: VehicleKey, t: Date): VehicleStatus;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const PRNG_SEED = 20_260_922;
/** Departure windows per day; every slot always consumes its random draws. */
const SLOTS_PER_DAY = 4;

export function buildHistory(now: Date): History {
  const clock = makeClock(now);
  const rng = prng(PRNG_SEED);
  const latestFinish = now.getTime() - LAST_FINISH_MARGIN_MS;

  const vehicleByPlate = new Map(VEHICLES.map((v) => [v.plate, v]));
  const busyVehicle = new Map<VehicleKey, number>();
  const busyDriver = new Map<DriverKey, number>();
  const trips: PlannedTrip[] = [];

  const opFor = (roll: number, day: number): OperatorKey => (day >= -148 && roll < 0.45 ? 'op2' : 'op1');

  // --- Trips, day by day. Every day consumes the same number of random draws
  //     regardless of what happens, so the history does not depend on the
  //     weekday the seed runs on.
  for (let day = START_DAY; day <= -1; day++) {
    const progress = (day - START_DAY) / (-1 - START_DAY);
    const seasonal = 0.35 * Math.sin((day / 30) * Math.PI);
    const expected = 2 + 1.6 * progress + seasonal; // business grows over time
    const [n1, n2, cRoll, cDest, cHour, cOp] = [rng(), rng(), rng(), rng(), rng(), rng()];
    const count = Math.max(0, Math.min(SLOTS_PER_DAY, Math.floor(expected + (n1 + n2 - 1))));

    // Occasionally a trip is planned and then cancelled before assignment.
    if (cRoll < 0.035) {
      const dest = weightedPick(DESTINATIONS, cDest)!;
      const departureAt = clock.at(day, 8 + cHour * 4);
      const createdBy = opFor(cOp, day - 3);
      trips.push({
        destination: dest.name,
        departureAt,
        createdAt: new Date(departureAt.getTime() - 3 * DAY_MS),
        createdBy,
        status: 'CANCELLED',
        estimatedDistanceKm: dest.km,
        estimatedTimeMin: Math.round((dest.km / 70) * 60),
        notes: 'El cliente reprogramó el envío',
        driver: null,
        vehicle: null,
        assignedAt: null,
        departureKm: null,
        arrivalKm: null,
        finishedAt: null,
        finishedBy: null,
        cancelledAt: new Date(departureAt.getTime() - DAY_MS),
        distance: 0,
      });
    }

    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const r = Array.from({ length: 12 }, () => rng());
      if (slot >= count) continue;
      const [rDest, rHour, rVehicle, rDriver, rDist, rDur, rCancel, rFinisher, rOp, rLead, rAssign, rNotes] =
        r as [number, number, number, number, number, number, number, number, number, number, number, number];

      const dest = weightedPick(DESTINATIONS, rDest)!;
      const departureAt = clock.at(day, 5 + slot * 3 + rHour * 2.5); // 05–08, 08–11, 11–14, 14–17
      const dep = departureAt.getTime();

      const vehicles = VEHICLES.filter(
        (v) =>
          v.joinedDay < day &&
          day <= (v.lastTripDay ?? -1) &&
          !inWindows(day, v.blocked) &&
          (busyVehicle.get(v.plate) ?? 0) + HOUR_MS <= dep,
      );
      const drivers = DRIVERS.filter(
        (d) =>
          d.joinedDay < day &&
          day <= (d.lastTripDay ?? -1) &&
          !inWindows(day, d.blocked) &&
          (busyDriver.get(d.key) ?? 0) + HOUR_MS <= dep,
      );
      const vehicle = weightedPick(vehicles, rVehicle);
      const driver = drivers[Math.floor(rDriver * drivers.length)];
      if (!vehicle || !driver) continue;

      const distance = Math.round(dest.km * (0.94 + 0.12 * rDist));
      const estimatedTimeMin = Math.round((dest.km / 70) * 60);
      const durationMs = (estimatedTimeMin * (0.95 + 0.2 * rDur) + 40) * 60_000;
      const cancelledOnRoute = rCancel < 0.012;
      // Cancelled on route 1–3 h after leaving (rCancel is uniform below the threshold).
      const end = cancelledOnRoute ? dep + (1 + 2 * (rCancel / 0.012)) * HOUR_MS : dep + durationMs;
      if (end > latestFinish) continue;

      let createdBy = opFor(rOp, day);
      const createdAt = new Date(dep - (1 + rLead * 3) * DAY_MS);
      if (createdBy === 'op2' && clock.dayOf(createdAt) < -150) createdBy = 'op1';

      busyVehicle.set(vehicle.plate, end);
      busyDriver.set(driver.key, end);

      trips.push({
        destination: dest.name,
        departureAt,
        createdAt,
        createdBy,
        status: cancelledOnRoute ? 'CANCELLED' : 'COMPLETED',
        estimatedDistanceKm: dest.km,
        estimatedTimeMin,
        notes: cancelledOnRoute
          ? 'Cancelado en ruta por desperfecto mecánico'
          : rNotes < 0.25
            ? TRIP_NOTES[Math.floor((rNotes / 0.25) * TRIP_NOTES.length)] ?? null
            : null,
        driver: driver.key,
        vehicle: vehicle.plate,
        assignedAt: new Date(dep - (5 + rAssign * 35) * 60_000),
        departureKm: null, // filled by the odometer pass below
        arrivalKm: null,
        finishedAt: cancelledOnRoute ? null : new Date(end),
        finishedBy: cancelledOnRoute ? null : rFinisher < 0.8 ? driver.key : createdBy,
        cancelledAt: cancelledOnRoute ? new Date(end) : null,
        distance: cancelledOnRoute ? 0 : distance,
      });
    }
  }

  // --- Today: María's in-progress trip on DDD444, and upcoming pending trips.
  const mendoza = DESTINATIONS.find((d) => d.name === 'Mendoza')!;
  trips.push({
    destination: mendoza.name,
    departureAt: new Date(now.getTime() - 3 * HOUR_MS),
    createdAt: new Date(now.getTime() - DAY_MS),
    createdBy: 'op1',
    status: 'IN_PROGRESS',
    estimatedDistanceKm: mendoza.km,
    estimatedTimeMin: Math.round((mendoza.km / 70) * 60),
    notes: null,
    driver: 'maria',
    vehicle: 'DDD444',
    assignedAt: new Date(now.getTime() - 3 * HOUR_MS - 10 * 60_000),
    departureKm: null,
    arrivalKm: null,
    finishedAt: null,
    finishedBy: null,
    cancelledAt: null,
    distance: 0,
  });
  const upcoming: { name: string; km: number; day: number; hour: number; createdHoursAgo: number; op: OperatorKey }[] = [
    { name: 'Rosario Centro', km: 15, day: 1, hour: 9, createdHoursAgo: 5, op: 'op1' },
    { name: 'Córdoba', km: 800, day: 2, hour: 6, createdHoursAgo: 2, op: 'op2' },
    { name: 'Santa Fe', km: 340, day: 4, hour: 7.5, createdHoursAgo: 1, op: 'op1' },
  ];
  for (const u of upcoming) {
    trips.push({
      destination: u.name,
      departureAt: clock.at(u.day, u.hour),
      createdAt: new Date(now.getTime() - u.createdHoursAgo * HOUR_MS),
      createdBy: u.op,
      status: 'PENDING_ASSIGNMENT',
      estimatedDistanceKm: u.km,
      estimatedTimeMin: Math.max(25, Math.round((u.km / 70) * 60)),
      notes: null,
      driver: null,
      vehicle: null,
      assignedAt: null,
      departureKm: null,
      arrivalKm: null,
      finishedAt: null,
      finishedBy: null,
      cancelledAt: null,
      distance: 0,
    });
  }

  // Trip ids should grow with creation time, like in real use.
  trips.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // --- Odometer pass + preventive maintenance, vehicle by vehicle.
  const maintenances: PlannedMaintenance[] = [];
  const vehicleFinal = {} as History['vehicleFinal'];

  const tripEnd = (t: PlannedTrip) => (t.finishedAt ?? t.cancelledAt ?? clock.now).getTime();

  for (const v of VEHICLES) {
    const own = trips
      .filter((t) => t.vehicle === v.plate)
      .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime());
    const completed = own.filter((t) => t.status === 'COMPLETED');

    // BBB222 must end overdue: its last service is placed before the shortest
    // tail of trips that adds up to more than the alert threshold.
    let forcedServiceBefore: PlannedTrip | null = null;
    if (v.plate === 'BBB222') {
      let tail = 0;
      for (let i = completed.length - 1; i >= 0; i--) {
        tail += completed[i]!.distance;
        if (tail >= KM_ALERT_THRESHOLD + 500) {
          forcedServiceBefore = completed[i]!;
          break;
        }
      }
      if (!forcedServiceBefore) throw new Error('BBB222 has too few km to end up overdue');
    }

    let km = v.startKm;
    let since = 0;
    let serviceCount = 0;
    let lastEnd = clock.at(v.joinedDay, 12).getTime();
    let overdueMode = false;

    for (const t of own) {
      if (t.status === 'COMPLETED' || t.status === 'IN_PROGRESS') {
        const dist = t.distance;
        const forced = t === forcedServiceBefore;
        const byPolicy = !overdueMode && since > 0 && since + dist > MAINTENANCE_POLICY_KM;
        if (forced || byPolicy) {
          const gap = t.departureAt.getTime() - lastEnd;
          const scheduled = lastEnd + Math.min(gap * 0.3, 20 * HOUR_MS);
          const done = scheduled + Math.min(gap * 0.4, 8 * HOUR_MS);
          const major = (serviceCount + 1) % 4 === 0;
          const scheduledAt = new Date(scheduled);
          const creatorDay = clock.dayOf(scheduledAt) - (2 + (serviceCount % 3));
          maintenances.push({
            vehicle: v.plate,
            type: major ? 'major' : 'minor',
            status: 'COMPLETED',
            createdAt: new Date(scheduled - (2 + (serviceCount % 3)) * DAY_MS),
            createdBy: creatorDay >= -148 && serviceCount % 2 === 1 ? 'op2' : 'op1',
            scheduledAt,
            startedAt: scheduledAt,
            completedAt: new Date(done),
            cancelledAt: null,
            km,
            nextMaintenanceKm: km + (major ? 20000 : KM_ALERT_THRESHOLD),
            notes: major ? 'Revisión de frenos, suspensión y alineación' : MAINTENANCE_NOTES[serviceCount % MAINTENANCE_NOTES.length] ?? null,
          });
          serviceCount += 1;
          since = 0;
          if (forced) overdueMode = true;
        }
        t.departureKm = km;
        if (t.status === 'COMPLETED') {
          km += dist;
          since += dist;
          t.arrivalKm = km;
        }
      } else if (t.status === 'CANCELLED') {
        // Cancelled on route: the odometer is not updated (nothing completed).
        t.departureKm = km;
      }
      lastEnd = tripEnd(t);
    }

    vehicleFinal[v.plate] = { km, lastMaintenanceDate: null };
  }

  // --- Special maintenances that tell a story.
  const planned = (m: Omit<PlannedMaintenance, 'nextMaintenanceKm'> & { nextMaintenanceKm?: number | null }) =>
    maintenances.push({ nextMaintenanceKm: null, ...m });

  // EEE555 is in the workshop right now.
  planned({
    vehicle: 'EEE555',
    type: 'minor',
    status: 'IN_PROGRESS',
    createdAt: new Date(now.getTime() - 3 * DAY_MS),
    createdBy: 'op2',
    scheduledAt: new Date(now.getTime() - 6 * HOUR_MS),
    startedAt: new Date(now.getTime() - 6 * HOUR_MS),
    completedAt: null,
    cancelledAt: null,
    km: vehicleFinal.EEE555.km,
    notes: 'Cambio de correa de distribución',
  });
  // CCC333: its scheduled service was cancelled when the unit was retired.
  planned({
    vehicle: 'CCC333',
    type: 'minor',
    status: 'CANCELLED',
    createdAt: clock.at(-44, 10),
    createdBy: 'op1',
    scheduledAt: clock.at(-42, 9),
    startedAt: null,
    completedAt: null,
    cancelledAt: clock.at(-40, 10),
    km: vehicleFinal.CCC333.km,
    notes: 'Cancelado: la unidad se da de baja',
  });
  // GGG777: next service already scheduled.
  planned({
    vehicle: 'GGG777',
    type: 'minor',
    status: 'PENDING',
    createdAt: new Date(now.getTime() - DAY_MS),
    createdBy: 'op2',
    scheduledAt: clock.at(5, 9),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    km: vehicleFinal.GGG777.km,
    notes: 'Service de rutina',
  });

  // AAA111: a service that started and was cancelled (spare part unavailable),
  // placed in the first long idle gap after day -90.
  {
    const own = trips
      .filter((t) => t.vehicle === 'AAA111')
      .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime());
    const services = maintenances.filter((m) => m.vehicle === 'AAA111' && m.startedAt);
    for (let i = 1; i < own.length; i++) {
      const gapStart = tripEnd(own[i - 1]!);
      const gapEnd = own[i]!.departureAt.getTime();
      if (clock.dayOf(new Date(gapStart)) < -90 || gapEnd - gapStart < 14 * HOUR_MS) continue;
      const clash = services.some(
        (m) => m.startedAt!.getTime() < gapEnd && (m.completedAt ?? m.cancelledAt)!.getTime() > gapStart,
      );
      if (clash) continue;
      const start = gapStart + 2 * HOUR_MS;
      planned({
        vehicle: 'AAA111',
        type: 'minor',
        status: 'CANCELLED',
        createdAt: new Date(start - 2 * DAY_MS),
        createdBy: 'op1',
        scheduledAt: new Date(start),
        startedAt: new Date(start),
        completedAt: null,
        cancelledAt: new Date(start + 4 * HOUR_MS),
        km: kmAtFrom(own, 'AAA111', new Date(start)),
        notes: 'Cancelado: repuesto sin stock, se reprograma',
      });
      break;
    }
  }

  maintenances.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const v of VEHICLES) {
    const last = maintenances
      .filter((m) => m.vehicle === v.plate && m.status === 'COMPLETED')
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
    vehicleFinal[v.plate].lastMaintenanceDate = last
      ? clock.dateOnly(clock.dayOf(last.completedAt!))
      : null;
  }

  // --- Driver denormalized stats (same formula as tripsService.finish).
  const driverStats = {} as History['driverStats'];
  for (const d of DRIVERS) {
    const done = trips.filter((t) => t.driver === d.key && t.status === 'COMPLETED');
    const total = done.reduce((s, t) => s + t.distance, 0);
    driverStats[d.key] = {
      completedTrips: done.length,
      avgKm: done.length ? Math.round((total / done.length) * 100) / 100 : 0,
    };
  }

  // --- Renewals, retirements and the alerts they raised/resolved.
  const { alerts, changes } = buildStories(clock, vehicleByPlate);

  function kmAtFrom(list: PlannedTrip[], plate: VehicleKey, t: Date): number {
    let km = vehicleByPlate.get(plate)!.startKm;
    for (const trip of list) {
      if (trip.vehicle === plate && trip.status === 'COMPLETED' && trip.finishedAt! <= t) {
        km = Math.max(km, trip.arrivalKm ?? km);
      }
    }
    return km;
  }

  return {
    clock,
    trips,
    maintenances,
    alerts,
    changes,
    vehicleFinal,
    driverStats,
    kmAt: (plate, t) => kmAtFrom(trips, plate, t),
    statusAt: (plate, t) => {
      const ms = t.getTime();
      const retired = changes.find((c) => c.kind === 'vehicleDeactivate' && c.vehicle === plate);
      if (retired && ms >= retired.at.getTime()) return 'INACTIVE';
      const onTrip = trips.some(
        (x) =>
          x.vehicle === plate &&
          x.assignedAt &&
          x.assignedAt.getTime() <= ms &&
          ms < (x.status === 'IN_PROGRESS' ? Infinity : tripEnd(x)),
      );
      if (onTrip) return 'ON_TRIP';
      const inShop = maintenances.some(
        (m) =>
          m.vehicle === plate &&
          m.startedAt &&
          m.startedAt.getTime() <= ms &&
          ms < ((m.completedAt ?? m.cancelledAt)?.getTime() ?? Infinity),
      );
      return inShop ? 'IN_WORKSHOP' : 'AVAILABLE';
    },
  };
}

function driverName(key: DriverKey): string {
  return DRIVERS.find((d) => d.key === key)!.name;
}

const soon = EXPIRY_ALERT_LEAD_DAYS;
const describeAlert = {
  licenseExpiring: (d: DriverKey) => `La licencia del chofer ${driverName(d)} vence en los próximos ${soon} días`,
  licenseExpired: (d: DriverKey) => `La licencia del chofer ${driverName(d)} está vencida`,
  documentExpiring: (t: DocType) => `El documento ${DOC_LABELS[t]} vence en los próximos ${soon} días`,
  documentExpired: (t: DocType) => `El documento ${DOC_LABELS[t]} está vencido`,
  insuranceExpiring: (p: VehicleKey) => `El seguro del vehículo ${p} vence en los próximos ${soon} días`,
  insuranceExpired: (p: VehicleKey) => `El seguro del vehículo ${p} está vencido`,
};

/**
 * Hand-written episodes, all resolved by now. Evaluations before the
 * automatic job existed were run by an admin in the morning (08:30), so
 * auto-resolutions line up with those runs.
 */
function buildStories(clock: Clock, vehicles: Map<VehicleKey, VehicleDef>) {
  const alerts: PlannedAlert[] = [];
  const changes: PlannedChange[] = [];
  const at = clock.at;
  const EVAL = 8.5;

  // AAA111 — insurance renewed before it lapsed; admin resolved the alert by hand.
  changes.push({ kind: 'vehicleInsurance', vehicle: 'AAA111', at: at(-168, 9.25), previousDays: -166, newDays: vehicles.get('AAA111')!.insuranceDays });
  alerts.push({ alertType: 'INSURANCE_EXPIRING', entity: { kind: 'vehicle', key: 'AAA111' }, description: describeAlert.insuranceExpiring('AAA111'), raisedAt: at(-179, EVAL), resolvedAt: at(-168, 9.5), resolution: 'manual' });

  // María — license renewed.
  changes.push({ kind: 'driverLicense', driver: 'maria', at: at(-140, 11), previousDays: -130, newDays: 300 });
  alerts.push({ alertType: 'LICENSE_EXPIRING', entity: { kind: 'driver', key: 'maria' }, description: describeAlert.licenseExpiring('maria'), raisedAt: at(-144, EVAL), resolvedAt: at(-140, 11.25), resolution: 'manual' });

  // GGG777 — insurance actually lapsed for three days (the unit could not be assigned).
  alerts.push({ alertType: 'INSURANCE_EXPIRING', entity: { kind: 'vehicle', key: 'GGG777' }, description: describeAlert.insuranceExpiring('GGG777'), raisedAt: at(-104, EVAL), resolvedAt: at(-90, EVAL), resolution: 'auto' });
  alerts.push({ alertType: 'INSURANCE_EXPIRED', entity: { kind: 'vehicle', key: 'GGG777' }, description: describeAlert.insuranceExpired('GGG777'), raisedAt: at(-90, EVAL), resolvedAt: at(-88, 9.75), resolution: 'manual' });
  changes.push({ kind: 'vehicleInsurance', vehicle: 'GGG777', at: at(-88, 9.5), previousDays: -90, newDays: vehicles.get('GGG777')!.insuranceDays });

  // Company phone changed.
  changes.push({ kind: 'companySettings', at: at(SETTINGS_CHANGED_DAY, 10) });

  // Roberto — license expired, never renewed; dismissed a week later.
  alerts.push({ alertType: 'LICENSE_EXPIRING', entity: { kind: 'driver', key: 'roberto' }, description: describeAlert.licenseExpiring('roberto'), raisedAt: at(-76, EVAL), resolvedAt: at(-62, EVAL), resolution: 'auto' });
  alerts.push({ alertType: 'LICENSE_EXPIRED', entity: { kind: 'driver', key: 'roberto' }, description: describeAlert.licenseExpired('roberto'), raisedAt: at(-62, EVAL), resolvedAt: at(-55, 12), resolution: 'auto' });
  changes.push({ kind: 'userDeactivate', user: 'roberto', at: at(-55, 11) });

  // Juan — license renewed two days before expiring.
  changes.push({ kind: 'driverLicense', driver: 'juan', at: at(-60, 10), previousDays: -58, newDays: 400 });
  alerts.push({ alertType: 'LICENSE_EXPIRING', entity: { kind: 'driver', key: 'juan' }, description: describeAlert.licenseExpiring('juan'), raisedAt: at(-72, EVAL), resolvedAt: at(-60, 10.25), resolution: 'manual' });

  // Carlos — psicofísico replaced before it expired.
  alerts.push({ alertType: 'DOCUMENT_EXPIRING', entity: { kind: 'document', key: 'carlos-psy-old' }, description: describeAlert.documentExpiring('PSYCHOPHYSICAL'), raisedAt: at(-54, EVAL), resolvedAt: at(-45, 10.5), resolution: 'auto' });

  // CCC333 — retired.
  changes.push({ kind: 'vehicleDeactivate', vehicle: 'CCC333', at: at(-40, 11) });

  // HHH888 — insurance renewed.
  changes.push({ kind: 'vehicleInsurance', vehicle: 'HHH888', at: at(-25, 9), previousDays: -20, newDays: vehicles.get('HHH888')!.insuranceDays });
  alerts.push({ alertType: 'INSURANCE_EXPIRING', entity: { kind: 'vehicle', key: 'HHH888' }, description: describeAlert.insuranceExpiring('HHH888'), raisedAt: at(-34, EVAL), resolvedAt: at(-25, 9.25), resolution: 'auto' });

  // Diego — DNI expired for a few days (he could not be assigned), then replaced.
  alerts.push({ alertType: 'DOCUMENT_EXPIRING', entity: { kind: 'document', key: 'diego-dni-old' }, description: describeAlert.documentExpiring('DNI'), raisedAt: at(-36, EVAL), resolvedAt: at(-22, EVAL), resolution: 'auto' });
  alerts.push({ alertType: 'DOCUMENT_EXPIRED', entity: { kind: 'document', key: 'diego-dni-old' }, description: describeAlert.documentExpired('DNI'), raisedAt: at(-22, EVAL), resolvedAt: at(-18, 10.5), resolution: 'auto' });

  // Sensitive reads of drivers' passwords (A-9).
  changes.push({ kind: 'viewCredentials', driver: 'juan', at: at(-200, 15) });
  changes.push({ kind: 'viewCredentials', driver: 'carlos', at: at(-95, 16.5) });
  changes.push({ kind: 'viewCredentials', driver: 'lucia', at: at(-30, 12) });
  changes.push({ kind: 'viewCredentials', driver: 'valentina', at: at(-12, 17) });

  return { alerts, changes };
}

// ---------------------------------------------------------------------------
// Audit rows
// ---------------------------------------------------------------------------

export interface IdMaps {
  users: Record<ActorKey, number>;
  vehicles: Record<VehicleKey, number>;
  /** Parallel to history.trips. */
  trips: number[];
  /** Parallel to history.maintenances. */
  maintenances: number[];
  documents: Record<string, number>;
  /** Parallel to history.alerts. */
  alerts: number[];
  maintenanceTypes: { minor: number; major: number };
}

export interface AuditRow {
  userId: number;
  action: string;
  entity: string;
  entityId: number | null;
  occurredAt: Date;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

/** JSON as the audit service stores it (dates → ISO strings). */
const iso = (d: Date) => d.toISOString();

/**
 * Builds every audit row for the generated history, in the same shapes the
 * services record. Pure: the database ids come in through `ids`.
 */
export function buildAuditRows(h: History, ids: IdMaps): AuditRow[] {
  const { clock } = h;
  const rows: AuditRow[] = [];
  const add = (row: AuditRow) => rows.push(row);
  const user = (k: ActorKey) => ids.users[k];

  const insuranceAt = new Map<VehicleKey, number>(VEHICLES.map((v) => [v.plate, v.insuranceDays]));
  const licenseAt = new Map<DriverKey, number>(DRIVERS.map((d) => [d.key, d.licenseDays]));
  for (const c of h.changes) {
    // Values in force BEFORE each renewal, so earlier snapshots are truthful.
    if (c.kind === 'vehicleInsurance') insuranceAt.set(c.vehicle, c.previousDays);
    if (c.kind === 'driverLicense') licenseAt.set(c.driver, c.previousDays);
  }

  const vehicleSnapshot = (v: VehicleDef, t: Date, insuranceDays: number) => ({
    licensePlate: v.plate,
    model: v.model,
    year: v.year,
    initialKm: v.startKm,
    accumulatedKm: h.kmAt(v.plate, t),
    insuranceExpiryDate: iso(clock.dateOnly(insuranceDays)),
    status: h.statusAt(v.plate, t),
  });
  const driverSnapshot = (d: DriverDef, licenseDays: number) => ({
    name: d.name,
    email: d.email,
    dni: d.dni,
    licenseCategory: d.licenseCategory,
    licenseExpiryDate: iso(clock.dateOnly(licenseDays)),
  });

  // Staff and drivers registered by the admin.
  for (const s of STAFF.filter((x) => x.key !== 'admin')) {
    add({
      userId: user('admin'),
      action: 'CREATE',
      entity: 'USER',
      entityId: user(s.key),
      occurredAt: clock.at(s.joinedDay, 10),
      newData: { name: s.name, email: s.email, role: s.role, isActive: true },
    });
  }
  for (const d of DRIVERS) {
    add({
      userId: user('admin'),
      action: 'CREATE',
      entity: 'DRIVER',
      entityId: user(d.key),
      occurredAt: clock.at(d.joinedDay, 10.5),
      newData: { name: d.name, email: d.email, dni: d.dni },
    });
  }

  // Vehicles registered by the admin.
  for (const v of VEHICLES) {
    const t = clock.at(v.joinedDay, 11);
    add({
      userId: user('admin'),
      action: 'CREATE',
      entity: 'VEHICLE',
      entityId: ids.vehicles[v.plate],
      occurredAt: t,
      newData: vehicleSnapshot(v, t, insuranceAt.get(v.plate)!),
    });
  }

  // Documents.
  for (const doc of DOCUMENTS) {
    const snapshot = {
      driverId: user(doc.driver),
      documentType: doc.type,
      expiryDate: iso(clock.dateOnly(doc.expiryDays)),
    };
    add({
      userId: user('admin'),
      action: 'CREATE',
      entity: 'DRIVER_DOCUMENT',
      entityId: ids.documents[doc.key]!,
      occurredAt: clock.at(doc.uploadedDay, 10 + (doc.deletedDay === undefined ? 0.5 : 0)),
      newData: snapshot,
    });
    if (doc.deletedDay !== undefined) {
      add({
        userId: user('admin'),
        action: 'DELETE',
        entity: 'DRIVER_DOCUMENT',
        entityId: ids.documents[doc.key]!,
        occurredAt: clock.at(doc.deletedDay, 10),
        previousData: snapshot,
      });
    }
  }

  // Trips.
  h.trips.forEach((t, i) => {
    const id = ids.trips[i]!;
    const creator = user(t.createdBy);
    add({
      userId: creator,
      action: 'CREATE',
      entity: 'TRIP',
      entityId: id,
      occurredAt: t.createdAt,
      newData: {
        destination: t.destination,
        departureAt: iso(t.departureAt),
        status: 'PENDING_ASSIGNMENT',
        driverId: null,
        vehicleId: null,
      },
    });
    if (t.assignedAt && t.driver && t.vehicle) {
      add({
        userId: creator,
        action: 'ASSIGN',
        entity: 'TRIP',
        entityId: id,
        occurredAt: t.assignedAt,
        previousData: { status: 'PENDING_ASSIGNMENT' },
        newData: {
          status: 'IN_PROGRESS',
          driverId: user(t.driver),
          vehicleId: ids.vehicles[t.vehicle],
          vehicleStatus: 'ON_TRIP',
        },
      });
    }
    if (t.status === 'COMPLETED') {
      add({
        userId: user(t.finishedBy!),
        action: 'FINISH',
        entity: 'TRIP',
        entityId: id,
        occurredAt: t.finishedAt!,
        previousData: { status: 'IN_PROGRESS' },
        newData: { status: 'COMPLETED', arrivalKm: t.arrivalKm, vehicleStatus: 'AVAILABLE' },
      });
    }
    if (t.status === 'CANCELLED') {
      const wasInProgress = t.assignedAt !== null;
      add({
        userId: creator,
        action: 'CANCEL',
        entity: 'TRIP',
        entityId: id,
        occurredAt: t.cancelledAt!,
        previousData: { status: wasInProgress ? 'IN_PROGRESS' : 'PENDING_ASSIGNMENT' },
        newData: { status: 'CANCELLED', ...(wasInProgress ? { vehicleStatus: 'AVAILABLE' } : {}) },
      });
    }
  });

  // Maintenances.
  h.maintenances.forEach((m, i) => {
    const id = ids.maintenances[i]!;
    const op = user(m.createdBy);
    add({
      userId: op,
      action: 'CREATE',
      entity: 'MAINTENANCE',
      entityId: id,
      occurredAt: m.createdAt,
      newData: {
        vehicleId: ids.vehicles[m.vehicle],
        maintenanceTypeId: ids.maintenanceTypes[m.type],
        status: 'PENDING',
        scheduledAt: iso(m.scheduledAt),
        km: m.km,
      },
    });
    if (m.startedAt) {
      add({
        userId: op,
        action: 'UPDATE',
        entity: 'MAINTENANCE',
        entityId: id,
        occurredAt: m.startedAt,
        previousData: { status: 'PENDING' },
        newData: { status: 'IN_PROGRESS', vehicleStatus: 'IN_WORKSHOP' },
      });
    }
    if (m.status === 'COMPLETED') {
      add({
        userId: op,
        action: 'FINISH',
        entity: 'MAINTENANCE',
        entityId: id,
        occurredAt: m.completedAt!,
        previousData: { status: 'IN_PROGRESS' },
        newData: { status: 'COMPLETED', vehicleStatus: 'AVAILABLE' },
      });
    }
    if (m.status === 'CANCELLED') {
      const released = m.startedAt !== null;
      add({
        userId: op,
        action: 'CANCEL',
        entity: 'MAINTENANCE',
        entityId: id,
        occurredAt: m.cancelledAt!,
        previousData: { status: released ? 'IN_PROGRESS' : 'PENDING' },
        newData: { status: 'CANCELLED', ...(released ? { vehicleStatus: 'AVAILABLE' } : {}) },
      });
    }
  });

  // Renewals, retirements, settings, credential reads.
  const vehicleDef = new Map(VEHICLES.map((v) => [v.plate, v]));
  const driverDef = new Map(DRIVERS.map((d) => [d.key, d]));
  for (const c of h.changes) {
    switch (c.kind) {
      case 'vehicleInsurance': {
        const v = vehicleDef.get(c.vehicle)!;
        add({
          userId: user('admin'),
          action: 'UPDATE',
          entity: 'VEHICLE',
          entityId: ids.vehicles[c.vehicle],
          occurredAt: c.at,
          previousData: vehicleSnapshot(v, c.at, c.previousDays),
          newData: vehicleSnapshot(v, c.at, c.newDays),
        });
        break;
      }
      case 'driverLicense': {
        const d = driverDef.get(c.driver)!;
        add({
          userId: user('admin'),
          action: 'UPDATE',
          entity: 'DRIVER',
          entityId: user(c.driver),
          occurredAt: c.at,
          previousData: driverSnapshot(d, c.previousDays),
          newData: driverSnapshot(d, c.newDays),
        });
        break;
      }
      case 'vehicleDeactivate':
        add({
          userId: user('admin'),
          action: 'DEACTIVATE',
          entity: 'VEHICLE',
          entityId: ids.vehicles[c.vehicle],
          occurredAt: c.at,
          previousData: { status: 'AVAILABLE' },
          newData: { status: 'INACTIVE' },
        });
        break;
      case 'userDeactivate':
        add({
          userId: user('admin'),
          action: 'DEACTIVATE',
          entity: 'USER',
          entityId: user(c.user),
          occurredAt: c.at,
          previousData: { isActive: true },
          newData: { isActive: false },
        });
        break;
      case 'viewCredentials':
        add({ userId: user('admin'), action: 'VIEW_CREDENTIALS', entity: 'DRIVER', entityId: user(c.driver), occurredAt: c.at });
        break;
      case 'companySettings': {
        const created = clock.at(-240, 9);
        const base = { ...COMPANY_SETTINGS };
        add({
          userId: user('admin'),
          action: 'UPDATE',
          entity: 'COMPANY_SETTINGS',
          entityId: 1,
          occurredAt: c.at,
          previousData: { ...base, phone: PREVIOUS_PHONE, updatedAt: iso(created) },
          newData: { ...base, updatedAt: iso(c.at) },
        });
        break;
      }
    }
  }

  // Alerts: manual resolutions leave a RESOLVE row; evaluations that created
  // or auto-resolved something leave the evaluator's summary row.
  const evaluations = new Map<number, { created: number; autoResolved: number }>();
  const bump = (t: Date, field: 'created' | 'autoResolved') => {
    const e = evaluations.get(t.getTime()) ?? { created: 0, autoResolved: 0 };
    e[field] += 1;
    evaluations.set(t.getTime(), e);
  };
  h.alerts.forEach((a, i) => {
    bump(a.raisedAt, 'created');
    if (a.resolution === 'auto') bump(a.resolvedAt, 'autoResolved');
    else {
      add({
        userId: user('admin'),
        action: 'RESOLVE',
        entity: 'ALERT',
        entityId: ids.alerts[i]!,
        occurredAt: a.resolvedAt,
        previousData: { status: 'PENDING', alertType: a.alertType },
        newData: { status: 'RESOLVED' },
      });
    }
  });
  for (const [ms, e] of evaluations) {
    const t = new Date(ms);
    const pending = h.alerts.filter((a) => a.raisedAt <= t && a.resolvedAt > t).length;
    add({
      userId: user('admin'),
      action: 'UPDATE',
      entity: 'ALERT',
      entityId: null,
      occurredAt: t,
      newData: { evaluated: Math.max(pending, e.created), created: e.created, autoResolved: e.autoResolved },
    });
  }

  return rows.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

