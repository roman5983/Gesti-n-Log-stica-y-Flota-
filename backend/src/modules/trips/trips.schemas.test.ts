import { describe, it, expect } from 'vitest';
import { createTripSchema, assignTripSchema, finishTripSchema } from './trips.schemas';

/** A calendar date safely in the future, regardless of when the suite runs. */
const futureDeparture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('trip schemas', () => {
  it('accepts a valid create payload and ignores origin (RN-21 fixed origin)', () => {
    const parsed = createTripSchema.parse({
      destination: 'Córdoba',
      departureAt: futureDeparture,
      // origin is not a field of the schema; even if sent, it is stripped.
      origin: 'anything',
    });
    expect(parsed.destination).toBe('Córdoba');
    expect('origin' in parsed).toBe(false);
  });

  it('rejects a create without destination', () => {
    expect(() => createTripSchema.parse({ departureAt: futureDeparture })).toThrow();
  });

  it('rejects a departureAt before today', () => {
    expect(() =>
      createTripSchema.parse({ destination: 'Córdoba', departureAt: '2020-01-01T10:00:00.000Z' }),
    ).toThrow();
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
