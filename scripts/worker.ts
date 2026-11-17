import 'dotenv/config';
import { getQueue } from '../src/lib/jobs';
import { drainMailOutbox } from '../src/lib/mail';
import { sql, pool } from '../src/lib/db';
import { syncBilling, type AwsConnection } from '../src/lib/aws';
import { scanFile } from '../src/lib/storage';
import { reconcilePayments } from '../src/lib/payments';
import { paymentProvider } from '../src/lib/config';
async function main() {
  const boss = await getQueue();
  await boss.schedule('payment-reconcile', '*/5 * * * *');
  await boss.work('payment-reconcile', async () => {
    if (paymentProvider() === 'stripe' && process.env.STRIPE_SECRET_KEY) await reconcilePayments();
  });
  await boss.work<{ connectionId: string }>('aws-sync', async (jobs) => {
    for (const job of jobs) {
      const connection = (
        await sql<AwsConnection>(
          "SELECT * FROM aws_connections WHERE id=$1 AND status='verified'",
          [job.data.connectionId],
        )
      )[0];
      if (connection)
        try {
          await syncBilling(connection);
        } catch (error) {
          await sql('UPDATE aws_connections SET last_error=$1 WHERE id=$2', [
            error instanceof Error ? error.message : 'Evidence ingestion failed',
            connection.id,
          ]);
          throw error;
        }
    }
  });
  await boss.work<{ fileId: string }>('file-scan', async (jobs) => {
    for (const job of jobs) await scanFile(job.data.fileId);
  });
  let draining = false;
  const tick = async () => {
    if (draining) return;
    draining = true;
    try {
      await drainMailOutbox();
    } catch (e) {
      console.error('Mail outbox drain failed', e);
    } finally {
      draining = false;
    }
  };
  await tick();
  const timer = setInterval(tick, 5000);
  const stop = async () => {
    clearInterval(timer);
    await boss.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(
    'HKGpipi worker running: durable AWS and malware scan jobs, payment reconciliation, transactional mail outbox.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
