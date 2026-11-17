'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
export function ContactForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Your message could not be saved. Please try again.');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return done ? (
    <div className="panel" role="status">
      <div className="eyebrow">MESSAGE RECEIVED</div>
      <h2>
        Thank you.
        <br />
        We have your enquiry.
      </h2>
      <p className="section-description">
        Your message has been recorded. HKGpipi will reply to the email address you provided.
      </p>
    </div>
  ) : (
    <form className="panel" onSubmit={submit}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="contact-name">Your name</label>
          <input id="contact-name" name="name" autoComplete="name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="contact-email">Work email</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
        <div className="field full">
          <label htmlFor="contact-company">Company</label>
          <input
            id="contact-company"
            name="company"
            autoComplete="organization"
            required
            maxLength={200}
          />
        </div>
        <div className="field full">
          <label htmlFor="contact-message">What would you like to discuss?</label>
          <textarea id="contact-message" name="message" required minLength={10} maxLength={5000} />
          <small>Do not include passwords, access keys, secrets or sensitive customer data.</small>
        </div>
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      <button className="button" disabled={busy}>
        {busy ? 'Sending…' : 'Send your enquiry'}
        <ArrowUpRight size={17} />
      </button>
      <p className="form-note" style={{ marginTop: 18 }}>
        We use your details to respond to this enquiry.{' '}
        <Link href="/privacy">Privacy information</Link>.
      </p>
    </form>
  );
}
