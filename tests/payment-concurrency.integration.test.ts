import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool, sql } from '../src/lib/db';
import { recordFinancialUpdate, type PaymentFinancialUpdate } from '../src/lib/payments';

const orderId = randomUUID(),
  paymentId = `pi_offline_${randomUUID()}`;
const tag = `hkg-payment-concurrency-${randomUUID()}`;
const originalApplicationName = pool.options.application_name;
let secondEventId: string;

beforeAll(async () => {
  pool.options.application_name = tag;
  await sql(
    "INSERT INTO orders(id,email,company,name,amount,currency,status,offer,checkout_key,terms_version,legal_snapshot,tax_snapshot,billing,provider,stripe_payment_id) VALUES($1,$2,'Concurrency fixture','Test payer',500000,'gbp','paid','savings-sprint',$3,'offline-test','{}','{}',$4,'stripe',$5)",
    [
      orderId,
      `${orderId}@concurrency.test`,
      randomUUID(),
      JSON.stringify({ total: 500000 }),
      paymentId,
    ],
  );
});
afterAll(async () => {
  await sql('DELETE FROM payment_events WHERE order_id=$1', [orderId]);
  await sql('DELETE FROM audit_events WHERE entity_id=$1', [orderId]);
  await sql('DELETE FROM orders WHERE id=$1', [orderId]);
  pool.options.application_name = originalApplicationName;
  await pool.end();
});

describe('authoritative financial reads serialize under the PostgreSQL order lock', () => {
  it('prevents the next provider snapshot from being fetched before the preceding update commits', async () => {
    let releaseFirst!: () => void, enteredFirst!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      enteredFirst = resolve;
    });
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = recordFinancialUpdate(
      `evt_first_${randomUUID()}`,
      'test.partial_refund',
      paymentId,
      async () => {
        enteredFirst();
        await holdFirst;
        return { status: 'partial_refunded', refundedAmount: 1000 };
      },
    );
    await firstEntered;
    let secondFetched = false;
    secondEventId = `evt_second_${randomUUID()}`;
    const second = recordFinancialUpdate(secondEventId, 'test.full_refund', paymentId, async () => {
      secondFetched = true;
      return { status: 'refunded', refundedAmount: 500000 };
    });
    try {
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (!blocked && Date.now() < deadline) {
        if (secondFetched)
          throw new Error('The second provider read ran before the first transaction committed.');
        const rows = await sql<{ count: string }>(
          "SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT id,organisation_id FROM orders WHERE stripe_payment_id=%FOR UPDATE'",
          [tag],
        );
        blocked = Number(rows[0].count) > 0;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      expect(secondFetched).toBe(false);
    } finally {
      releaseFirst();
    }
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    const [order] = await sql<{ status: string; billing: PaymentFinancialUpdate }>(
      'SELECT status,billing FROM orders WHERE id=$1',
      [orderId],
    );
    expect(order.status).toBe('refunded');
    expect(order.billing.refundedAmount).toBe(500000);
  });

  it('deduplicates committed events without calling the provider again', async () => {
    const provider = vi.fn(async (): Promise<PaymentFinancialUpdate> => ({
      status: 'paid',
      refundedAmount: 0,
    }));
    await expect(
      recordFinancialUpdate(secondEventId, 'test.full_refund', paymentId, provider),
    ).resolves.toBe(false);
    expect(provider).not.toHaveBeenCalled();
    const [order] = await sql<{ status: string }>('SELECT status FROM orders WHERE id=$1', [
      orderId,
    ]);
    expect(order.status).toBe('refunded');
  });
});
