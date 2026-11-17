import { afterEach, describe, it, expect, vi } from 'vitest';
import { clientIp } from '../src/lib/client-ip';
afterEach(() => vi.unstubAllEnvs());
describe('trusted ingress IP selection', () => {
  it('uses only the appended ALB source, ignoring a forged left side and CF header', () => {
    vi.stubEnv('TRUSTED_PROXY', 'alb');
    expect(
      clientIp(
        new Request('https://example.test', {
          headers: {
            'x-forwarded-for': '192.0.2.9, 198.51.100.10',
            'cf-connecting-ip': '192.0.2.99',
          },
        }),
      ),
    ).toBe('198.51.100.10');
  });
  it('supports IPv6 and does not accept malformed production addresses', () => {
    vi.stubEnv('TRUSTED_PROXY', 'alb');
    expect(
      clientIp(
        new Request('https://example.test', {
          headers: { 'x-forwarded-for': '[2001:db8::1]:443' },
        }),
      ),
    ).toBe('2001:db8::1');
    expect(
      clientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': 'spoof' } })),
    ).toBe('unknown');
  });
  it('does not trust arbitrary forwarding headers without a production proxy policy', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUSTED_PROXY', 'none');
    expect(
      clientIp(
        new Request('https://example.test', { headers: { 'x-forwarded-for': '192.0.2.9' } }),
      ),
    ).toBe('unknown');
  });
});
