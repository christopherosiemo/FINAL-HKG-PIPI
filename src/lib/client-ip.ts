import { isIP } from 'node:net';
function address(value: string | null): string | null {
  if (!value) return null;
  const last = value.split(',').at(-1)?.trim() || '';
  const candidate = last.startsWith('[')
    ? last.slice(1, last.indexOf(']'))
    : isIP(last)
      ? last
      : last.replace(/:\d+$/, '');
  return isIP(candidate) ? candidate : null;
}
/** The ingress must be the only way to reach the web container. ALB appends the
 * actual source address, so the client-controlled left side is never trusted. */
export function clientIp(request: Request): string {
  const proxy = process.env.TRUSTED_PROXY;
  if (proxy === 'alb') return address(request.headers.get('x-forwarded-for')) || 'unknown';
  if (proxy === 'cloudflare') return address(request.headers.get('cf-connecting-ip')) || 'unknown';
  if (process.env.NODE_ENV !== 'production')
    return (
      address(request.headers.get('x-forwarded-for')) ||
      address(request.headers.get('cf-connecting-ip')) ||
      '127.0.0.1'
    );
  return 'unknown';
}
