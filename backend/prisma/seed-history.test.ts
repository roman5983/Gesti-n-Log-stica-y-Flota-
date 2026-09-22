import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DOCUMENTS,
  DRIVERS,
  HOUR_MS,
  KM_ALERT_THRESHOLD,
  STAFF,
  VEHICLES,
  buildAuditRows,
  buildHistory,
  type ActorKey,
  type History,
  type IdMaps,
  type PlannedTrip,
  type VehicleKey,
} from './seed-history';

/**
 * The seed writes ~200 days of history straight into the tables, bypassing the
 * services — so the business rules the services enforce are checked here,
 * on the generated plan, without a database.
 */

const NOW = new Date('2026-09-22T15:00:00.000Z');
const h = buildHistory(NOW);
const { clock } = h;
const EXPIRY_LEAD_DAYS = 14;

const tripEnd = (t: PlannedTrip) => (t.finishedAt ?? t.cancelledAt ?? NOW).getTime();
const assigned = h.trips.filter((t) => t.assignedAt !== null);
const completed = h.trips.filter((t) => t.status === 'COMPLETED');

function overlaps(intervals: [number, number][]): boolean {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  return sorted.some((iv, i) => i > 0 && iv[0] < sorted[i - 1]![1]);
}

/** Value in force at `t` for a field that changed once (renewal). */
function valueAt(finalDays: number, t: Date, change?: { at: Date; previousDays: number }): number {
  return change && t < change.at ? change.previousDays : finalDays;
}

describe('seed history — volume and shape', () => {
  it('looks like months of real use', () => {
    expect(completed.length).toBeGreaterThan(400);
    // Services follow the km policy: one every ~9,000 km driven, per vehicle.
    for (const v of VEHICLES) {
      const services = h.maintenances.filter((m) => m.vehicle === v.plate && m.status === 'COMPLETED');
      const driven = h.vehicleFinal[v.plate].km - v.startKm;
      expect(services.length, v.plate).toBeGreaterThanOrEqual(Math.floor(driven / 10000));
      expect(services.length, v.plate).toBeGreaterThanOrEqual(1);
    }
    expect(h.maintenances.filter((m) => m.status === 'COMPLETED').length).toBeGreaterThanOrEqual(15);
    expect(h.trips.filter((t) => t.status === 'CANCELLED').length).toBeGreaterThanOrEqual(3);
    expect(h.alerts.length).toBeGreaterThanOrEqual(8);
  });

  it('fills every month of the dashboard chart (last 6 months)', () => {
    for (let back = 0; back < 6; back++) {
      const from = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - back, 1));
      const to = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - back + 1, 1));
      const inMonth = completed.filter((t) => t.finishedAt! >= from && t.finishedAt! < to).length;
      expect(inMonth, `month -${back}`).toBeGreaterThan(back === 0 ? 20 : 25);
    }
  });

  it('is deterministic and does not depend on the weekday it runs', () => {
    const again = buildHistory(NOW);
    expect(JSON.stringify(again.trips)).toBe(JSON.stringify(h.trips));
    const shifted = buildHistory(new Date(NOW.getTime() + 3 * DAY_MS));
    expect(shifted.trips.map((t) => [t.status, t.driver, t.vehicle, t.distance])).toEqual(
      h.trips.map((t) => [t.status, t.driver, t.vehicle, t.distance]),
    );
  });
});

describe('seed history — business rules', () => {
  it('never puts a driver on two trips at once', () => {
    for (const d of DRIVERS) {
      const own = assigned.filter((t) => t.driver === d.key);
      expect(overlaps(own.map((t) => [t.assignedAt!.getTime(), tripEnd(t)])), d.key).toBe(false);
    }
  });

  it('never puts a vehicle on two things at once (trips and workshop)', () => {
    for (const v of VEHICLES) {
      const intervals: [number, number][] = [
        ...assigned.filter((t) => t.vehicle === v.plate).map((t): [number, number] => [t.assignedAt!.getTime(), tripEnd(t)]),
        ...h.maintenances
          .filter((m) => m.vehicle === v.plate && m.startedAt)
          .map((m): [number, number] => [m.startedAt!.getTime(), (m.completedAt ?? m.cancelledAt ?? NOW).getTime()]),
      ];
      expect(overlaps(intervals), v.plate).toBe(false);
    }
  });

  it('keeps every odometer chain consistent (RN-5, RN-11)', () => {
    for (const v of VEHICLES) {
      let km = v.startKm;
      const own = completed
        .filter((t) => t.vehicle === v.plate)
        .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime());
      for (const t of own) {
        expect(t.departureKm).toBe(km);
        expect(t.arrivalKm!).toBeGreaterThan(t.departureKm!);
        km = t.arrivalKm!;
      }
      expect(h.vehicleFinal[v.plate].km, v.plate).toBe(km);
    }
    for (const t of assigned) expect(t.departureKm, 'departure km snapshot').toBe(h.kmAt(t.vehicle!, t.assignedAt!));
    for (const m of h.maintenances.filter((x) => x.startedAt)) expect(m.km).toBe(h.kmAt(m.vehicle, m.startedAt!));
  });

  it('only assigns drivers with a valid license and no expired documents (RN-1, RN-4)', () => {
    for (const t of assigned) {
      const d = DRIVERS.find((x) => x.key === t.driver)!;
      const day = clock.dayOf(t.assignedAt!);
      const renewal = h.changes.find((c) => c.kind === 'driverLicense' && c.driver === d.key) as
        | { at: Date; previousDays: number }
        | undefined;
      expect(valueAt(d.licenseDays, t.assignedAt!, renewal), `${d.key} license on day ${day}`).toBeGreaterThanOrEqual(day);
      expect(day, `${d.key} joined`).toBeGreaterThan(d.joinedDay);

      const expiredDoc = DOCUMENTS.filter((doc) => doc.driver === d.key)
        .filter((doc) => doc.uploadedDay <= day && (doc.deletedDay === undefined || doc.deletedDay > day))
        .find((doc) => doc.expiryDays < day);
      expect(expiredDoc, `${d.key} expired doc on day ${day}`).toBeUndefined();
    }
  });

  it('only assigns insured, active vehicles (pickAvailableVehicle)', () => {
    for (const t of assigned.filter((x) => x.status !== 'IN_PROGRESS')) {
      const v = VEHICLES.find((x) => x.plate === t.vehicle)!;
      const day = clock.dayOf(t.assignedAt!);
      const renewal = h.changes.find((c) => c.kind === 'vehicleInsurance' && c.vehicle === v.plate) as
        | { at: Date; previousDays: number }
        | undefined;
      expect(valueAt(v.insuranceDays, t.assignedAt!, renewal), `${v.plate} insurance on day ${day}`).toBeGreaterThanOrEqual(day);
      expect(h.statusAt(v.plate, new Date(t.assignedAt!.getTime() - 60_000)), `${v.plate} status`).toBe('AVAILABLE');
    }
  });

  it('keeps timestamps in order and the present coherent', () => {
    for (const t of h.trips) {
      if (t.assignedAt) expect(t.createdAt < t.assignedAt).toBe(true);
      if (t.status === 'COMPLETED') expect(t.finishedAt!.getTime()).toBeLessThanOrEqual(NOW.getTime() - 8 * HOUR_MS);
      if (t.status === 'PENDING_ASSIGNMENT') expect(t.departureAt > NOW).toBe(true);
    }
    const inProgress = h.trips.filter((t) => t.status === 'IN_PROGRESS');
    expect(inProgress.map((t) => [t.driver, t.vehicle])).toEqual([['maria', 'DDD444']]);
    for (const v of VEHICLES) expect(h.statusAt(v.plate, NOW), v.plate).toBe(v.finalStatus);
  });

  it('keeps driver stats equal to their completed trips', () => {
    for (const d of DRIVERS) {
      const own = completed.filter((t) => t.driver === d.key);
      expect(h.driverStats[d.key].completedTrips).toBe(own.length);
      if (own.length) {
        const avg = own.reduce((s, t) => s + (t.arrivalKm! - t.departureKm!), 0) / own.length;
        expect(h.driverStats[d.key].avgKm).toBeCloseTo(avg, 2);
      }
    }
  });
});

describe('seed history — what the alert evaluator will find', () => {
  /** Mirrors alertsService.scanConditions on the final state. */
  function expectedPendingAlerts(history: History): string[] {
    const found: string[] = [];
    const lead = EXPIRY_LEAD_DAYS;
    for (const d of DRIVERS.filter((x) => x.active)) {
      if (d.licenseDays < 0) found.push(`LICENSE_EXPIRED:${d.key}`);
      else if (d.licenseDays <= lead) found.push(`LICENSE_EXPIRING:${d.key}`);
    }
    for (const doc of DOCUMENTS.filter((x) => x.deletedDay === undefined)) {
      if (!DRIVERS.find((d) => d.key === doc.driver)!.active) continue;
      if (doc.expiryDays < 0) found.push(`DOCUMENT_EXPIRED:${doc.key}`);
      else if (doc.expiryDays <= lead) found.push(`DOCUMENT_EXPIRING:${doc.key}`);
    }
    for (const v of VEHICLES) {
      if (v.insuranceDays < 0) found.push(`INSURANCE_EXPIRED:${v.plate}`);
      else if (v.insuranceDays <= lead) found.push(`INSURANCE_EXPIRING:${v.plate}`);
      if (v.finalStatus === 'INACTIVE') found.push(`VEHICLE_INACTIVE:${v.plate}`);
      if (v.finalStatus !== 'INACTIVE' && v.finalStatus !== 'IN_WORKSHOP') {
        const baseline = Math.max(
          v.startKm,
          ...history.maintenances.filter((m) => m.vehicle === v.plate && m.status === 'COMPLETED').map((m) => m.km),
        );
        if (history.vehicleFinal[v.plate].km - baseline >= KM_ALERT_THRESHOLD) found.push(`MAINTENANCE_KM_EXCEEDED:${v.plate}`);
      }
    }
    return found.sort();
  }

  it('produces exactly the demo alerts, and no accidental ones', () => {
    expect(expectedPendingAlerts(h)).toEqual(
      [
        'DOCUMENT_EXPIRED:lucia-license',
        'DOCUMENT_EXPIRING:carlos-license',
        'DOCUMENT_EXPIRING:juan-art',
        'DOCUMENT_EXPIRING:maria-art',
        'INSURANCE_EXPIRED:CCC333',
        'INSURANCE_EXPIRING:BBB222',
        'LICENSE_EXPIRED:lucia',
        'LICENSE_EXPIRING:carlos',
        'MAINTENANCE_KM_EXCEEDED:BBB222',
        'VEHICLE_INACTIVE:CCC333',
      ].sort(),
    );
  });

  it('resolves every historical alert after raising it', () => {
    for (const a of h.alerts) expect(a.resolvedAt > a.raisedAt, a.alertType).toBe(true);
  });
});

describe('seed history — audit rows', () => {
  const fakeIds: IdMaps = {
    users: Object.fromEntries(
      [...STAFF.map((s) => s.key), ...DRIVERS.map((d) => d.key)].map((k, i) => [k, i + 1]),
    ) as Record<ActorKey, number>,
    vehicles: Object.fromEntries(VEHICLES.map((v, i) => [v.plate, 100 + i])) as Record<VehicleKey, number>,
    trips: h.trips.map((_, i) => 1000 + i),
    maintenances: h.maintenances.map((_, i) => 5000 + i),
    documents: Object.fromEntries(DOCUMENTS.map((d, i) => [d.key, 7000 + i])),
    alerts: h.alerts.map((_, i) => 9000 + i),
    maintenanceTypes: { minor: 1, major: 2 },
  };
  const rows = buildAuditRows(h, fakeIds);

  it('references real actors and entities, in chronological order', () => {
    const validUsers = new Set(Object.values(fakeIds.users));
    for (const r of rows) {
      expect(validUsers.has(r.userId), `${r.action} ${r.entity}`).toBe(true);
      if (!(r.entity === 'ALERT' && r.action === 'UPDATE')) expect(typeof r.entityId).toBe('number');
    }
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.occurredAt >= rows[i - 1]!.occurredAt).toBe(true);
    expect(rows.every((r) => r.occurredAt <= NOW)).toBe(true);
  });

  it('records one ASSIGN per assigned trip and one FINISH per completed trip', () => {
    const count = (action: string) => rows.filter((r) => r.entity === 'TRIP' && r.action === action).length;
    expect(count('ASSIGN')).toBe(assigned.length);
    expect(count('FINISH')).toBe(completed.length);
    expect(count('CREATE')).toBe(h.trips.length);
  });

  it('never contains undefined values (they would not survive JSON)', () => {
    const hasUndefined = (o?: Record<string, unknown>) => !!o && Object.values(o).some((v) => v === undefined);
    expect(rows.some((r) => hasUndefined(r.previousData) || hasUndefined(r.newData))).toBe(false);
  });

  it('only uses actions the frontend knows how to translate', () => {
    const known = new Set(['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'ASSIGN', 'FINISH', 'CANCEL', 'RESOLVE', 'VIEW_CREDENTIALS']);
    expect(rows.filter((r) => !known.has(r.action))).toEqual([]);
  });
});
