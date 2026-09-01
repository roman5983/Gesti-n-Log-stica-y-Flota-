import { describe, it, expect } from 'vitest';
import { createUserSchema, listUsersQuerySchema } from './users.schemas';

describe('user schemas', () => {
  it('accepts ADMIN/OPERATOR but rejects DRIVER on create (drivers go via /drivers)', () => {
    expect(createUserSchema.parse({ name: 'Ana', email: 'a@x.com', password: 'Pass1234', role: 'OPERATOR' }).role).toBe('OPERATOR');
    expect(() =>
      createUserSchema.parse({ name: 'Ana', email: 'a@x.com', password: 'Pass1234', role: 'DRIVER' }),
    ).toThrow();
  });

  it('enforces password rules (min 8, letter + number)', () => {
    const valid = { name: 'Ana', email: 'a@x.com', role: 'ADMIN' as const };
    expect(() => createUserSchema.parse({ ...valid, password: 'short1' })).toThrow();
    expect(() => createUserSchema.parse({ ...valid, password: 'onlyletters' })).toThrow();
    expect(createUserSchema.parse({ ...valid, password: 'Valid123' }).password).toBe('Valid123');
  });

  it('parses role as a comma-separated list into an array', () => {
    const parsed = listUsersQuerySchema.parse({ role: 'ADMIN,OPERATOR' });
    expect(parsed.role).toEqual(['ADMIN', 'OPERATOR']);
  });

  it('rejects an invalid role in the list', () => {
    expect(() => listUsersQuerySchema.parse({ role: 'ADMIN,SUPERVISOR' })).toThrow();
  });
});
