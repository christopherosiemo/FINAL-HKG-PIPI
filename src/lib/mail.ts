import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { sql, transaction } from './db';
import { appUrl } from './config';
export function escapeEmail(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function renderMailHtml(subject: string, text: string) {
  const base = appUrl();
  const linkified = text
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part) => {
      if (!/^https?:\/\//.test(part)) return escapeEmail(part).replace(/\n/g, '<br>');
      try {
        const url = new URL(part);
        if (!['http:', 'https:'].includes(url.protocol)) return escapeEmail(part);
        return `<a href="${escapeEmail(url.href)}" style="color:#176b65;text-decoration:underline;word-break:break-all">Open secure link →</a>`;
      } catch {
        return escapeEmail(part);
      }
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmail(subject)}</title></head><body style="margin:0;background:#f1f3f2;color:#172930;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f3f2"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #dde4e1;border-top:5px solid #122d3b"><tr><td style="padding:32px 36px 28px;border-bottom:1px solid #e1e7e4"><a href="${escapeEmail(base)}"><img src="${escapeEmail(base)}/brand-wordmark.png" alt="HKGpipi" width="172" style="display:block;width:172px;max-width:100%;height:auto;border:0"></a><p style="font-size:10px;letter-spacing:2px;color:#536c72;margin:20px 0 0">AWS CLOUD MARGIN RECOVERY</p></td></tr><tr><td style="padding:32px 36px 40px"><h1 style="font-size:25px;line-height:1.25;letter-spacing:-.5px;color:#122d3b;margin:0 0 24px;font-weight:600">${escapeEmail(subject)}</h1><div style="font-size:15px;line-height:1.8;color:#354c54">${linkified}</div></td></tr><tr><td style="padding:24px 36px;background:#122d3b;color:#cedbdc;font-size:12px;line-height:1.8"><strong style="color:#fff">HKGpipi</strong><br>Engineering-led AWS cost reduction, verified against the bill.<br><a href="mailto:enquiries@hkgpipi.com" style="color:#cedbdc">enquiries@hkgpipi.com</a> &nbsp; · &nbsp; <a href="${escapeEmail(base)}/privacy" style="color:#cedbdc">Privacy</a><br>Never send AWS passwords or access keys by email.</td></tr></table></td></tr></table></body></html>`;
}
export type OutboxMail = {
  id: string;
  to_email: string;
  subject: string;
  text_body: string;
  html_body: string | null;
};
export async function enqueueMail(to: string, subject: string, text: string, html?: string) {
  await sql(
    'INSERT INTO mail_outbox(id,to_email,subject,text_body,html_body) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), to, subject, text, html || null],
  );
}
export async function deliverMail(mail: OutboxMail) {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error('SMTP_HOST is not configured; mail remains queued.');
  const secure = process.env.SMTP_SECURE === 'true';
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 1025),
    secure,
    requireTLS: process.env.NODE_ENV === 'production' && !secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'HKGpipi <enquiries@hkgpipi.com>',
    to: mail.to_email,
    subject: mail.subject,
    text: mail.text_body,
    html: mail.html_body || renderMailHtml(mail.subject, mail.text_body),
    messageId: `<${mail.id}@hkgpipi.com>`,
  });
}
export async function drainMailOutbox() {
  // A locked row is held until SMTP acknowledges it. A crash can cause at-least-once
  // delivery; the stable Message-ID allows downstream deduplication.
  for (let i = 0; i < 20; i++) {
    const found = await transaction(async (client) => {
      const { rows } = await client.query<OutboxMail>(
        "SELECT * FROM mail_outbox WHERE status='pending' AND attempts < 10 AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      if (!rows[0]) return false;
      try {
        await deliverMail(rows[0]);
        await client.query(
          "UPDATE mail_outbox SET status='sent',sent_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1",
          [rows[0].id],
        );
      } catch {
        await client.query(
          "UPDATE mail_outbox SET attempts=attempts+1,next_attempt_at=now()+(LEAST(3600,30*power(2,attempts)) * interval '1 second'),last_error='SMTP delivery failed; inspect provider logs' WHERE id=$1",
          [rows[0].id],
        );
        return false;
      }
      return true;
    });
    if (!found) break;
  }
}
