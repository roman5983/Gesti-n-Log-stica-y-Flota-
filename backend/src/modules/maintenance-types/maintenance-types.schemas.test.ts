import { describe, it, expect } from 'vitest';
import { createMaintenanceTypeSchema } from './maintenance-types.schemas';

const base = { name: 'Preventivo test', description: 'desc', kmAlert: 10000, kmTarget: 20000 };

describe('maintenance type schema (RN-13 thresholds)', () => {
  it('accepts kmTarget >= kmAlert', () => {
    expect(createMaintenanceTypeSchema.parse(base).kmTarget).toBe(20000);
  });

  it('rejects kmTarget < kmAlert (cross-field)', () => {
    expect(() => createMaintenanceTypeSchema.parse({ ...base, kmTarget: 5000 })).toThrow();
  });

  it('rejects monthsTarget < monthsAlert when both present', () => {
    expect(() =>
      createMaintenanceTypeSchema.parse({ ...base, monthsAlert: 6, monthsTarget: 3 }),
    ).toThrow();
  });

  it('allows optional months to be omitted', () => {
    const parsed = createMaintenanceTypeSchema.parse(base);
    expect(parsed.monthsAlert).toBeUndefined();
  });
});
