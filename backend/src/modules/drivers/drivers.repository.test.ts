import { describe, it, expect, vi } from 'vitest';

// The WHERE builder is pure; the Prisma client is stubbed out.
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));

import { buildDriverWhere } from './drivers.repository';

const REQUIRED = ['DNI', 'LICENSE', 'ART', 'PSYCHOPHYSICAL'];

describe('buildDriverWhere — "available" means assignable today', () => {
  it('requires a valid document of every RN-4 type, besides license, trip and active user', () => {
    const where = buildDriverWhere({ available: true });
    expect(where.user).toEqual({ is: { deletedAt: null, isActive: true } });
    expect(where.trips).toEqual({ none: { status: 'IN_PROGRESS' } });
    expect(where.licenseExpiryDate).toHaveProperty('gte');
    const docTypes = (where.AND as { documents: { some: { documentType: string; deletedAt: null } } }[]).map(
      (c) => c.documents.some.documentType,
    );
    expect(docTypes).toEqual(REQUIRED);
    for (const c of where.AND as { documents: { some: { deletedAt: null; expiryDate: { gte: Date } } } }[]) {
      expect(c.documents.some.deletedAt).toBeNull();
      expect(c.documents.some.expiryDate.gte).toBeInstanceOf(Date);
    }
  });

  it('"not available" is exactly the negation of the same criteria', () => {
    const yes = buildDriverWhere({ available: true });
    const no = buildDriverWhere({ available: false });
    expect(no.NOT).toEqual({
      user: yes.user,
      licenseExpiryDate: yes.licenseExpiryDate,
      trips: yes.trips,
      AND: yes.AND,
    });
    expect(no.user).toEqual({ deletedAt: null });
  });

  it('without the filter, only excludes deleted users', () => {
    expect(buildDriverWhere({})).toEqual({ user: { deletedAt: null } });
  });
});
