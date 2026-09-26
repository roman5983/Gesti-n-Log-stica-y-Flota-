import { describe, it, expect } from 'vitest';
import { updateSettingsSchema } from './settings.schemas';

describe('updateSettingsSchema', () => {
  it('accepts a valid partial update', () => {
    const parsed = updateSettingsSchema.parse({
      companyName: 'Transportes Pérez S.A.',
      phone: '+54 341 555-1234',
    });
    expect(parsed.companyName).toBe('Transportes Pérez S.A.');
    expect(parsed.phone).toBe('+54 341 555-1234');
  });

  it('rejects an empty body (at least one field required)', () => {
    expect(() => updateSettingsSchema.parse({})).toThrow();
  });

  it('accepts updating only the email', () => {
    const parsed = updateSettingsSchema.parse({ email: 'contacto@empresa.com' });
    expect(parsed.email).toBe('contacto@empresa.com');
  });

  it('rejects an invalid email format', () => {
    expect(() => updateSettingsSchema.parse({ email: 'not-an-email' })).toThrow();
  });

  it('rejects companyName over 150 characters', () => {
    expect(() => updateSettingsSchema.parse({ companyName: 'X'.repeat(151) })).toThrow();
  });

  it('rejects empty string fields (min 1)', () => {
    expect(() => updateSettingsSchema.parse({ timezone: '' })).toThrow();
    expect(() => updateSettingsSchema.parse({ language: '' })).toThrow();
    expect(() => updateSettingsSchema.parse({ dateFormat: '' })).toThrow();
  });

  it('accepts valid timezone and language values', () => {
    const parsed = updateSettingsSchema.parse({
      timezone: 'America/Argentina/Buenos_Aires',
      language: 'es',
      dateFormat: 'DD/MM/YYYY',
    });
    expect(parsed.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(parsed.language).toBe('es');
    expect(parsed.dateFormat).toBe('DD/MM/YYYY');
  });

  it('rejects taxId over 13 characters', () => {
    expect(() => updateSettingsSchema.parse({ taxId: '12345678901234' })).toThrow();
  });

  it('accepts a valid taxId', () => {
    const parsed = updateSettingsSchema.parse({ taxId: '30-12345678-9' });
    expect(parsed.taxId).toBe('30-12345678-9');
  });
});
