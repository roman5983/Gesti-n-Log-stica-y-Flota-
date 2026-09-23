import { describe, expect, it } from 'vitest';
import { alertPresentation } from './AlertCard.helpers';
import { ALERT_TYPE_CODES } from './AlertCard.data';

describe('alertPresentation (alert cards)', () => {
  it('expired is red and expiring is amber, with the tag in words', () => {
    expect(alertPresentation('LICENSE_EXPIRED')).toMatchObject({ tone: 'error', tag: 'Vencida' });
    expect(alertPresentation('LICENSE_EXPIRING')).toMatchObject({ tone: 'warning', tag: 'Por vencer' });
    expect(alertPresentation('INSURANCE_EXPIRED').tone).toBe('error');
    expect(alertPresentation('DOCUMENT_EXPIRING').tone).toBe('warning');
  });

  it('the icon identifies the category: same for expired and expiring', () => {
    expect(alertPresentation('DOCUMENT_EXPIRED').icon).toBe(alertPresentation('DOCUMENT_EXPIRING').icon);
    expect(alertPresentation('LICENSE_EXPIRED').icon).not.toBe(alertPresentation('DOCUMENT_EXPIRED').icon);
    expect(alertPresentation('MAINTENANCE_KM_EXCEEDED').category).toBe('maintenance');
  });

  it('every known type has a Spanish label, an icon and a status tone', () => {
    for (const code of ALERT_TYPE_CODES) {
      const p = alertPresentation(code);
      expect(p.label).not.toBe(code);
      expect(p.icon).toBeTruthy();
      // Alerts never use the primary (reserved for actions) nor success.
      expect(['error', 'warning', 'info']).toContain(p.tone);
    }
  });

  it('an unknown backend type still renders, with its code and the info tone', () => {
    const p = alertPresentation('SOMETHING_NEW');
    expect(p).toMatchObject({ label: 'SOMETHING_NEW', category: 'other', tone: 'info' });
    expect(p.icon).toBeTruthy();
  });

  it('covers every type the backend emits', () => {
    expect([...ALERT_TYPE_CODES].sort()).toEqual(
      [
        'DOCUMENT_EXPIRED',
        'DOCUMENT_EXPIRING',
        'INSURANCE_EXPIRED',
        'INSURANCE_EXPIRING',
        'LICENSE_EXPIRED',
        'LICENSE_EXPIRING',
        'MAINTENANCE_KM_EXCEEDED',
        'VEHICLE_INACTIVE',
      ].sort(),
    );
  });
});
