import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

const req = (headers: Record<string, string | string[]>, ip = '56.124.35.103') =>
  ({ headers, ip, socket: { remoteAddress: '100.64.0.8' } }) as unknown as Request;

describe('clientIp', () => {
  it('without a configured header uses req.ip', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '190.192.41.180' }), '')).toBe('56.124.35.103');
  });

  it('with the header configured takes its first value', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '190.192.41.180' }), 'x-vercel-forwarded-for')).toBe(
      '190.192.41.180',
    );
    expect(clientIp(req({ 'x-vercel-forwarded-for': ' 1.2.3.4 , 5.6.7.8' }), 'x-vercel-forwarded-for')).toBe(
      '1.2.3.4',
    );
  });

  it('falls back to req.ip when the request does not bring the header', () => {
    expect(clientIp(req({}), 'x-vercel-forwarded-for')).toBe('56.124.35.103');
    expect(clientIp(req({ 'x-vercel-forwarded-for': '' }), 'x-vercel-forwarded-for')).toBe('56.124.35.103');
  });
});
