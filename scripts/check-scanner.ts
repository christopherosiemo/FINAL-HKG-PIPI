import 'dotenv/config';
import { scanBuffer } from '../src/lib/storage';
import { pool } from '../src/lib/db';
async function main() {
  const clean = await scanBuffer(
    Buffer.from('HKGpipi safe engineering-evidence integration test.'),
  );
  const eicar = Buffer.from(
    'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
    'base64',
  );
  const infected = await scanBuffer(eicar);
  if (!clean.clean || infected.clean)
    throw new Error('Scanner failed clean-file or EICAR rejection verification.');
  console.log('Real ClamAV verified: clean file accepted; standard EICAR antivirus test rejected.');
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Scanner check failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
