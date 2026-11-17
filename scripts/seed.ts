import 'dotenv/config';
import { pool } from '../src/lib/db';
async function main() {
  await pool.query(
    "INSERT INTO settings(key,value) VALUES('commercial', $1::jsonb) ON CONFLICT(key) DO NOTHING",
    [
      JSON.stringify({
        savingsSprintPrice: 500000,
        implementationPrice: 1500000,
        currency: 'GBP',
        outcomePercentage: 25,
        legalApproved: false,
        taxApproved: false,
      }),
    ],
  );
  console.log(
    'Operational defaults created. No invented customers, results, or credentials were seeded.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
