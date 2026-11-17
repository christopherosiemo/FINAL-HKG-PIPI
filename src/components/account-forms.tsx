'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
type Mode = 'login' | 'signup' | 'forgot' | 'reset';
function safeNext(value?: string) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/activate';
}
export function AccountForm({ mode, next, token }: { mode: Mode; next?: string; token?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [twoFactor, setTwoFactor] = useState(false),
    [backup, setBackup] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');
    try {
      if (twoFactor) {
        const code = String(data.get('code'));
        const result = backup
          ? await authClient.twoFactor.verifyBackupCode({ code, disableSession: false })
          : await authClient.twoFactor.verifyTotp({ code });
        if (result.error) throw new Error(result.error.message);
        window.location.assign(safeNext(next));
        return;
      }
      if (mode === 'login') {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: safeNext(next),
        });
        if (result.error) throw new Error(result.error.message);
        if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
          setTwoFactor(true);
          return;
        }
        window.location.assign(safeNext(next));
      }
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          email,
          password,
          name: String(data.get('name')),
          callbackURL: '/activate',
        });
        if (result.error) throw new Error(result.error.message);
        setMessage(
          'Check your inbox for the verification link. Then sign in to activate your engagement.',
        );
      }
      if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });
        if (result.error) throw new Error(result.error.message);
        setMessage('If an account exists for this email, a password recovery link will be sent.');
      }
      if (mode === 'reset') {
        if (!token) throw new Error('This reset link is incomplete. Request a new one.');
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error(result.error.message);
        setMessage('Your password has been changed. You can now sign in.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel account-form">
      <div aria-live="polite">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
      </div>
      {!message && (
        <>
          {twoFactor ? (
            <>
              <p>Enter the code from your authenticator app, or use a recovery code.</p>
              <label className="field">
                {backup ? 'Recovery code' : 'Authenticator code'}
                <input
                  name="code"
                  autoComplete="one-time-code"
                  inputMode={backup ? 'text' : 'numeric'}
                  required
                  minLength={6}
                />
              </label>
              <button className="button-secondary" type="button" onClick={() => setBackup(!backup)}>
                {backup ? 'Use authenticator' : 'Use recovery code'}
              </button>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <label className="field">
                  Full name
                  <input name="name" autoComplete="name" minLength={2} maxLength={100} required />
                </label>
              )}
              {mode !== 'reset' && (
                <label className="field">
                  Work email
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
              )}
              {mode !== 'forgot' && (
                <label className="field">
                  {mode === 'reset' ? 'New password' : 'Password'}
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'login' ? 1 : 12}
                    maxLength={128}
                    required
                  />
                  {mode !== 'login' && (
                    <small>Use at least 12 characters. A unique passphrase is recommended.</small>
                  )}
                </label>
              )}
            </>
          )}
          <button className="button" disabled={busy}>
            {busy
              ? 'Please wait…'
              : twoFactor
                ? 'Verify sign in'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'signup'
                    ? 'Create account'
                    : mode === 'forgot'
                      ? 'Send recovery link'
                      : 'Save password'}
          </button>
        </>
      )}
      <div className="account-links">
        {mode === 'login' ? (
          <>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/signup">Create an account</Link>
          </>
        ) : (
          <Link href="/login">Return to sign in</Link>
        )}
      </div>
    </form>
  );
}
export function ActivationPanel() {
  const { data: session, isPending } = authClient.useSession();
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  async function claim() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/activation/claim', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(
        d.claimed
          ? 'Your engagement is linked to your account. Continue to onboarding.'
          : 'Your account is ready. Any paid order matching your verified email is linked. If payment is still processing, return here shortly.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activation failed.');
    } finally {
      setBusy(false);
    }
  }
  async function resend(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await authClient.sendVerificationEmail({
        email: session?.user.email || email,
        callbackURL: '/activate',
      });
      if (result.error) throw new Error(result.error.message);
      setMessage('If verification is needed, a new link will be sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification email could not be requested.');
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <p role="status">Checking your account…</p>;
  return (
    <div className="panel account-form">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {session?.user.emailVerified ? (
        <>
          <p>
            Signed in as <strong>{session.user.email}</strong>. Engagement access is granted only to
            the verified ordering email or an explicit invitation.
          </p>
          <button className="button" onClick={claim} disabled={busy}>
            {busy ? 'Linking engagement…' : 'Activate my engagement'}
          </button>
          <Link className="button-secondary" href="/portal">
            Continue to my workspace
          </Link>
        </>
      ) : (
        <>
          <p>
            Create an account using the email on your order, then verify your email. This connects
            your order without granting access to anyone else at your company.
          </p>
          <div className="account-links">
            <Link className="button" href="/signup">
              Create account
            </Link>
            <Link className="button-secondary" href="/login">
              Sign in
            </Link>
          </div>
          <form onSubmit={resend}>
            <label className="field">
              Resend email verification
              <input
                type="email"
                required
                value={session?.user.email || email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <button className="button-secondary" disabled={busy}>
              Send verification link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
