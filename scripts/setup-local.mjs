import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
if (process.env.NODE_ENV === 'production')
  throw new Error('Local fixture setup is prohibited in production.');
try {
  await access('.env');
  console.log('.env already exists and was preserved.');
  process.exit(0);
} catch {}
let text = await readFile('.env.example', 'utf8');
const values = {
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
  PAYMENTS_PROVIDER: 'test',
  ENABLE_TEST_PAYMENTS: 'true',
  LEGAL_APPROVED: 'true',
  LEGAL_TERMS_VERSION: 'local-fixture-v1',
  LEGAL_TERMS_URL: 'http://127.0.0.1:3001/terms',
  LEGAL_PRIVACY_URL: 'http://127.0.0.1:3001/privacy',
  SELLER_LEGAL_NAME: 'HKGpipi LOCAL TEST FIXTURE',
  SELLER_ADDRESS: 'Local development fixture only',
  TAX_APPROVED: 'true',
  TAX_MODE: 'exempt',
  TAX_LABEL: 'Local test fixture - no real tax or payment',
};
for (const [key, value] of Object.entries(values))
  text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
await writeFile('.env', text, { flag: 'wx', mode: 0o600 });
console.log(
  'Created ignored .env with a random local auth secret and EXPLICIT test-only commercial fixtures. No provider credentials were created. Never deploy this file.',
);
