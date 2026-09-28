import { describe, it, expect } from 'vitest';
import { createVehicleSchema, updateVehicleSchema, listVehiclesQuerySchema } from './vehicles.schemas';

const validBase = {
  licensePlate: 'AB123CD',
  model: 'Sprinter 415',
  year: 2024,
  initialKm: 50000,
};

describe('createVehicleSchema', () => {
  it('accepts a valid vehicle and upper-cases the plate', () => {
    const parsed = createVehicleSchema.parse({ ...validBase, licensePlate: 'ab 123 cd' });
    expect(parsed.licensePlate).toBe('AB 123 CD');
    expect(parsed.initialKm).toBe(50000);
  });

  it('coerces numeric strings for year and initialKm', () => {
    const parsed = createVehicleSchema.parse({ ...validBase, year: '2022', initialKm: '0' });
    expect(parsed.year).toBe(2022);
    expect(parsed.initialKm).toBe(0);
  });

  it('rejects a plate shorter than 6 chars', () => {
    expect(() => createVehicleSchema.parse({ ...validBase, licensePlate: 'AB12' })).toThrow();
  });

  it('rejects a plate with special characters', () => {
    expect(() => createVehicleSchema.parse({ ...validBase, licensePlate: 'AB-123-CD' })).toThrow();
  });

  it('rejects a year before 1950', () => {
    expect(() => createVehicleSchema.parse({ ...validBase, year: 1949 })).toThrow();
  });

  it('rejects a year more than 1 above current', () => {
    const farFuture = new Date().getFullYear() + 2;
    expect(() => createVehicleSchema.parse({ ...validBase, year: farFuture })).toThrow();
  });

  it('accepts next year (current + 1)', () => {
    const nextYear = new Date().getFullYear() + 1;
    const parsed = createVehicleSchema.parse({ ...validBase, year: nextYear });
    expect(parsed.year).toBe(nextYear);
  });

  it('rejects negative initialKm', () => {
    expect(() => createVehicleSchema.parse({ ...validBase, initialKm: -1 })).toThrow();
  });

  it('accepts an optional insuranceExpiryDate and coerces it to Date', () => {
    const parsed = createVehicleSchema.parse({
      ...validBase,
      insuranceExpiryDate: '2027-06-30',
    });
    expect(parsed.insuranceExpiryDate).toBeInstanceOf(Date);
  });

  it('accepts missing insuranceExpiryDate', () => {
    const parsed = createVehicleSchema.parse(validBase);
    expect(parsed.insuranceExpiryDate).toBeUndefined();
  });

  it('rejects a model shorter than 2 chars', () => {
    expect(() => createVehicleSchema.parse({ ...validBase, model: 'X' })).toThrow();
  });
});

describe('updateVehicleSchema', () => {
  it('accepts a partial update with only one field', () => {
    const parsed = updateVehicleSchema.parse({ model: 'New Model 500' });
    expect(parsed.model).toBe('New Model 500');
  });

  it('rejects an empty body (no fields)', () => {
    expect(() => updateVehicleSchema.parse({})).toThrow();
  });

  it('allows nullable insuranceExpiryDate (clearing the date)', () => {
    const parsed = updateVehicleSchema.parse({ insuranceExpiryDate: null });
    expect(parsed.insuranceExpiryDate).toBeNull();
  });
});

describe('listVehiclesQuerySchema', () => {
  it('defaults page=1, limit=10 when omitted', () => {
    const parsed = listVehiclesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
  });

  it('accepts a valid status filter', () => {
    const parsed = listVehiclesQuerySchema.parse({ status: 'ON_TRIP' });
    expect(parsed.status).toBe('ON_TRIP');
  });

  it('rejects an invalid status value', () => {
    expect(() => listVehiclesQuerySchema.parse({ status: 'FLYING' })).toThrow();
  });

  it('trims search and converts blank to undefined', () => {
    const parsed = listVehiclesQuerySchema.parse({ search: '   ' });
    expect(parsed.search).toBeUndefined();
  });

  it('keeps a non-blank search after trimming', () => {
    const parsed = listVehiclesQuerySchema.parse({ search: ' Sprinter ' });
    expect(parsed.search).toBe('Sprinter');
  });
});
