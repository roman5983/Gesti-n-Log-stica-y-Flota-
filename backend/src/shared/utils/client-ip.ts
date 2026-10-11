import type { Request } from 'express';

/**
 * The end user's IP. With `header` set (env.CLIENT_IP_HEADER, e.g.
 * "x-vercel-forwarded-for"), its first value; otherwise — or if the request
 * did not bring it — req.ip, already resolved through "trust proxy".
 */
export function clientIp(req: Request, header: string): string {
  if (header) {
    const raw = req.headers[header];
    const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
