'use client';
import { useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
function AccountProfile() {
  const { data: session, refetch } = authClient.useSession();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function updateName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const name = String(new FormData(e.currentTarget).get('name') || '').trim();
      if (name.length < 2 || name.length > 100)
        throw new Error('Use a name between 2 and 100 characters.');
      const r = await authClient.updateUser({ name });
      if (r.error) throw new Error(r.error.message);
      await refetch();
      setMessage('Your profile name has been updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profile update failed.');
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = e.currentTarget,
      values = new FormData(form);
    try {
      if (values.get('newPassword') !== values.get('confirmPassword'))
        throw new Error('The new passwords do not match.');
      const r = await authClient.changePassword({
        currentPassword: String(values.get('currentPassword')),
        newPassword: String(values.get('newPassword')),
        revokeOtherSessions: true,
      });
      if (r.error) throw new Error(r.error.message);
      form.reset();
      setMessage('Your password has been changed and other sessions have been signed out.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password change failed.');
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await authClient.revokeOtherSessions();
      if (r.error) throw new Error(r.error.message);
      setMessage('All other sessions have been signed out. This session remains active.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Session revocation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-profile">
      <h2>Profile and sessions</h2>
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
      <form onSubmit={updateName}>
        <label className="field">
          Profile name
          <input
            name="name"
            autoComplete="name"
            defaultValue={session?.user.name || ''}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label className="field">
          Verified account email
          <input value={session?.user.email || ''} readOnly type="email" />
        </label>
        <button className="button-secondary" disabled={busy}>
          Save profile
        </button>
      </form>
      <h3>Change password</h3>
      <form onSubmit={password}>
        <label className="field">
          Current password
          <input name="currentPassword" type="password" autoComplete="current-password" required />
        </label>
        <label className="field">
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label className="field">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <button className="button-secondary" disabled={busy}>
          Change password
        </button>
      </form>
      <h3>Other signed-in sessions</h3>
      <p>
        Sign out other browsers and devices if you no longer use them or suspect access you do not
        recognise.
      </p>
      <button className="button-secondary" disabled={busy} onClick={revoke}>
        Sign out other sessions
      </button>
    </section>
  );
}
export function AccountSecurity() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [password, setPassword] = useState(''),
    [qr, setQr] = useState(''),
    [uri, setUri] = useState(''),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function enroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await authClient.twoFactor.enable({ password });
      if (r.error) throw new Error(r.error.message);
      if (r.data && r.data.method === 'totp') {
        setUri(r.data.totpURI);
        setQr(await QRCode.toDataURL(r.data.totpURI, { width: 240, margin: 2 }));
        setCodes(r.data.backupCodes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed.');
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await authClient.twoFactor.verifyTotp({
        code: String(new FormData(e.currentTarget).get('code')),
      });
      if (r.error) throw new Error(r.error.message);
      setQr('');
      setUri('');
      setPassword('');
      setMessage(
        'Authenticator verified. Two-factor authentication is active. Store your recovery codes before leaving.',
      );
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }
  async function regenerate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await authClient.twoFactor.generateBackupCodes({ password });
      if (r.error) throw new Error(r.error.message);
      if (r.data) setCodes(r.data.backupCodes);
      setMessage('New recovery codes generated. All previous recovery codes are invalid.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recovery code generation failed.');
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <p role="status">Loading account security…</p>;
  if (!session)
    return (
      <p>
        Please <Link href="/login?next=/account-security">sign in</Link> to manage account security.
      </p>
    );
  const enabled = !!(session.user as typeof session.user & { twoFactorEnabled?: boolean })
    .twoFactorEnabled;
  return (
    <div className="panel account-form">
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
      <p>
        Authenticator protection is <strong>{enabled ? 'active' : 'not yet enabled'}</strong>. It is
        required for all administrators.
      </p>
      {!enabled && !qr && (
        <form onSubmit={enroll}>
          <label className="field">
            Confirm your password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? 'Preparing…' : 'Set up authenticator'}
          </button>
        </form>
      )}
      {qr && (
        <>
          <p>
            Scan this code with your authenticator app, then enter its six-digit code to complete
            enrollment.
          </p>
          <img src={qr} width="240" height="240" alt="Authenticator enrollment QR code" />
          <details>
            <summary>Manual setup URI</summary>
            <code className="security-secret">{uri}</code>
          </details>
          <form onSubmit={verify}>
            <label className="field">
              Authenticator code
              <input
                name="code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <button className="button" disabled={busy}>
              Verify authenticator
            </button>
          </form>
        </>
      )}
      {enabled && (
        <form onSubmit={regenerate}>
          <label className="field">
            Password to replace recovery codes
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button-secondary" disabled={busy}>
            Generate new recovery codes
          </button>
        </form>
      )}
      {codes.length > 0 && (
        <div className="recovery-codes">
          <h2>Save your recovery codes</h2>
          <p>
            Each code can be used once if your authenticator is unavailable. Store them in a
            password manager. They are shown only now.
          </p>
          <pre>{codes.join('\n')}</pre>
          <button
            className="button-secondary"
            onClick={() => {
              const blob = new Blob([`HKGpipi recovery codes\n${codes.join('\n')}`], {
                type: 'text/plain',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'hkgpipi-recovery-codes.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download recovery codes
          </button>
        </div>
      )}
      <AccountProfile />
      <p>
        <Link href="/portal">Return to workspace</Link> · <Link href="/admin">Administration</Link>
      </p>
    </div>
  );
}
