import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { auth } from '../src/lib/auth';
import { sql, pool } from '../src/lib/db';
async function main() {
  const [emailArg, nameArg] = process.argv.slice(2);
  const email = emailArg?.toLowerCase();
  if (!email || !nameArg)
    throw new Error(
      'Usage: npm run admin:create -- owner@example.com "Owner name". Set ADMIN_BOOTSTRAP_PASSWORD to a unique password of at least 16 characters.',
    );
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!password || password.length < 16)
    throw new Error(
      'ADMIN_BOOTSTRAP_PASSWORD must be at least 16 characters. Never pass passwords as CLI arguments.',
    );
  const existing = await sql<{ id: string; role: string }>(
    'SELECT id,role FROM "user" WHERE email=$1',
    [email],
  );
  if (existing[0])
    throw new Error(
      'Account already exists. This bootstrap command never promotes existing accounts.',
    );
  const result = await auth.api.signUpEmail({ body: { email, password, name: nameArg } });
  await sql('UPDATE "user" SET role=\'admin\' WHERE id=$1', [result.user.id]);
  await sql(
    "INSERT INTO audit_events(id,actor_id,action,entity_id,detail) VALUES($1,'bootstrap-cli','admin.created',$2,$3)",
    [randomUUID(), result.user.id, JSON.stringify({ email })],
  );
  console.log(
    'Administrator created. Verify the email, sign in and enroll an authenticator at /account-security. Administrative data remains blocked until MFA is active.',
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Administrator creation failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
