import { describe, it, expect } from 'vitest';
import { createDriverSchema } from './drivers.schemas';

const base = {
  name: 'Juan Pérez',
  email: 'juan@x.com',
  password: 'Driver1234',
  dni: '30123456',
  licenseCategory: 'C' as const,
  licenseExpiryDate: '2027-06-30',
};

describe('driver schema', () => {
  it('accepts a valid driver', () => {
    const parsed = createDriverSchema.parse(base);
    expect(parsed.dni).toBe('30123456');
    expect(parsed.licenseExpiryDate).toBeInstanceOf(Date);
  });

  it('rejects a non-numeric DNI', () => {
    expect(() => createDriverSchema.parse({ ...base, dni: 'ABC123' })).toThrow();
  });

  it('rejects an invalid license category', () => {
    expect(() => createDriverSchema.parse({ ...base, licenseCategory: 'Z' })).toThrow();
  });
});
