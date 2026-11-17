import { PgBoss } from 'pg-boss';

let queuePromise: Promise<PgBoss> | undefined;
export async function getQueue() {
  if (!queuePromise)
    queuePromise = (async () => {
      const boss = new PgBoss({
        connectionString:
          process.env.DATABASE_URL ?? 'postgresql://hkgpipi:hkgpipi@127.0.0.1:55432/hkgpipi',
        schema: 'jobs',
      });
      boss.on('error', (error) => console.error('Background queue error', error.message));
      await boss.start();
      await boss.createQueue('failed-jobs');
      for (const [name, retryLimit, retryDelay] of [
        ['aws-sync', 3, 60],
        ['file-scan', 5, 30],
        ['payment-reconcile', 3, 30],
      ] as const) {
        await boss.createQueue(name);
        await boss.updateQueue(name, {
          retryLimit,
          retryDelay,
          retryBackoff: true,
          deadLetter: 'failed-jobs',
        });
      }
      return boss;
    })().catch((error) => {
      queuePromise = undefined;
      throw error;
    });
  return queuePromise;
}
export async function enqueueJob(name: 'aws-sync' | 'file-scan', data: Record<string, unknown>) {
  return (await getQueue()).send(name, data);
}
