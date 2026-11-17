import { createServer, type Server } from 'node:net';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/access', () => ({ requireAccess: vi.fn() }));
import { scanBuffer } from '../src/lib/storage';
let server: Server;
const originalHost = process.env.CLAMAV_HOST,
  originalPort = process.env.CLAMAV_PORT;
beforeAll(async () => {
  server = createServer((socket) => {
    let pending = Buffer.alloc(0),
      payload = Buffer.alloc(0),
      commandSeen = false;
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      if (!commandSeen) {
        if (pending.length < 10) return;
        expect(pending.subarray(0, 10).toString()).toBe('zINSTREAM\0');
        pending = pending.subarray(10);
        commandSeen = true;
      }
      while (pending.length >= 4) {
        const n = pending.readUInt32BE(0);
        if (pending.length < n + 4) return;
        pending = pending.subarray(4);
        if (n === 0) {
          socket.end(
            payload.includes(Buffer.from('EICAR'))
              ? 'stream: Eicar-Test-Signature FOUND\0'
              : 'stream: OK\0',
          );
          return;
        }
        payload = Buffer.concat([payload, pending.subarray(0, n)]);
        pending = pending.subarray(n);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.CLAMAV_HOST = '127.0.0.1';
  process.env.CLAMAV_PORT = String((server.address() as { port: number }).port);
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalHost === undefined) delete process.env.CLAMAV_HOST;
  else process.env.CLAMAV_HOST = originalHost;
  if (originalPort === undefined) delete process.env.CLAMAV_PORT;
  else process.env.CLAMAV_PORT = originalPort;
});
describe('ClamAV INSTREAM protocol contract (local test scanner)', () => {
  it('streams real file bytes and accepts an explicit clean response', async () => {
    await expect(scanBuffer(Buffer.from('Safe engineering evidence'))).resolves.toMatchObject({
      clean: true,
    });
  });
  it('rejects a virus response', async () => {
    await expect(scanBuffer(Buffer.from('EICAR fixture'))).resolves.toMatchObject({ clean: false });
  });
  it('fails closed when no scanner is configured', async () => {
    const host = process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_HOST;
    await expect(scanBuffer(Buffer.from('Evidence'))).rejects.toMatchObject({ status: 503 });
    process.env.CLAMAV_HOST = host;
  });
});
