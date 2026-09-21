import { describe, it, expect } from 'vitest';
import { reportQuerySchema, MAX_REPORT_DAYS } from './reports.schemas';

describe('report query schema', () => {
  it('accepts a single day and a full leap year (366 days inclusive)', () => {
    expect(reportQuerySchema.safeParse({ dateFrom: '2026-01-01', dateTo: '2026-01-01' }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ dateFrom: '2024-01-01', dateTo: '2024-12-31' }).success).toBe(true);
  });

  it('rejects a period longer than the maximum', () => {
    const r = reportQuerySchema.safeParse({ dateFrom: '2024-01-01', dateTo: '2025-01-01' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toContain(String(MAX_REPORT_DAYS));
    expect(reportQuerySchema.safeParse({ dateFrom: '1900-01-01', dateTo: '2100-01-01' }).success).toBe(false);
  });

  it('still rejects dateTo before dateFrom', () => {
    expect(reportQuerySchema.safeParse({ dateFrom: '2026-02-01', dateTo: '2026-01-01' }).success).toBe(false);
  });
});
