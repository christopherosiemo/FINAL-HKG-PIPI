import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import { pool, sql } from './db';
import { enqueueMail } from './mail';
import { appUrl } from './config';
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  if (process.env.NODE_ENV === 'production' && !appUrl().startsWith('https://'))
    throw new Error('Production authentication requires an HTTPS application URL.');
  return betterAuth({
    appName: 'HKGpipi',
    baseURL: appUrl(),
    secret,
    database: pool,
    trustedOrigins: [appUrl()],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!['/two-factor/verify-totp', '/two-factor/verify-backup-code'].includes(ctx.path))
          return;
        if (ctx.context.returned instanceof APIError) return;
        const verified = ctx.context.newSession;
        // Only the maintained plugin's successfully challenged session is marked.
        if (verified)
          await sql('UPDATE "session" SET mfa_verified_at=now() WHERE id=$1 AND "userId"=$2', [
            verified.session.id,
            verified.user.id,
          ]);
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await enqueueMail(
          user.email,
          'Reset your HKGpipi password',
          `Use this link to choose a new password: ${url}\nIf you did not request this, ignore this email.`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await enqueueMail(
          user.email,
          'Verify your HKGpipi email',
          `Verify your email to activate your HKGpipi account: ${url}\nThis link expires in one hour.`,
        );
      },
    },
    user: {
      additionalFields: { role: { type: 'string', defaultValue: 'customer', input: false } },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 12,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 40,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    plugins: [
      twoFactor({ issuer: 'HKGpipi', backupCodeOptions: { storeBackupCodes: 'encrypted' } }),
    ],
    advanced: {
      ipAddress: { ipAddressHeaders: ['x-hkg-client-ip'] },
      useSecureCookies: appUrl().startsWith('https://'),
      defaultCookieAttributes: {
        sameSite: 'lax',
        httpOnly: true,
        secure: appUrl().startsWith('https://'),
      },
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
function getAuth() {
  return (instance ||= createAuth());
}
// Lazy construction keeps build-time route discovery independent of live secrets.
export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_target, key) {
    return Reflect.get(getAuth(), key);
  },
});
