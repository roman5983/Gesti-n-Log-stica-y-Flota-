import { describe, it, expect } from 'vitest';
import { createTripSchema, assignTripSchema, finishTripSchema } from './trips.schemas';

describe('trip schemas', () => {
  it('accepts a valid create payload and ignores origin (RN-21 fixed origin)', () => {
    const parsed = createTripSchema.parse({
      destination: 'Córdoba',
      departureAt: '2026-08-01T10:00:00.000Z',
      // origin is not a field of the schema; even if sent, it is stripped.
      origin: 'anything',
    });
    expect(parsed.destination).toBe('Córdoba');
    expect('origin' in parsed).toBe(false);
  });

  it('rejects a create without destination', () => {
    expect(() => createTripSchema.parse({ departureAt: '2026-08-01T10:00:00Z' })).toThrow();
  });

  it('assign requires a positive driverId', () => {
    expect(assignTripSchema.parse({ driverId: 3 }).driverId).toBe(3);
    expect(() => assignTripSchema.parse({ driverId: 0 })).toThrow();
  });

  it('finish requires a non-negative arrivalKm', () => {
    expect(finishTripSchema.parse({ arrivalKm: 1000 }).arrivalKm).toBe(1000);
    expect(() => finishTripSchema.parse({ arrivalKm: -1 })).toThrow();
  });
});
