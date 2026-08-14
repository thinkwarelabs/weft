import 'server-only'
import { env } from '@/lib/env'

// Sends the feedback link via Resend's HTTP API directly — no SDK dependency,
// and nothing here is reused by the internal SMTP notifications.
//
// The raw token appears in exactly one place in this file, the href, and is
// never logged. If you add logging to this module, log the token ID, never the
// URL.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface FeedbackEmail {
  to: string
  contactName: string
  projectName: string
  prompt: string
  url: string
  expiresAt: Date
}

function buildHtml(e: FeedbackEmail): string {
  const url = escapeHtml(e.url)
  const expires = e.expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
          <tr><td style="padding:32px 32px 0 32px;">
            <p style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#111827;">Thinkware Labs</p>
          </td></tr>
          <tr><td style="padding:24px 32px 4px 32px;">
            <h1 style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#111827;">Your feedback on ${escapeHtml(e.projectName)}</h1>
            <p style="margin:0 0 12px 0;font-size:14px;line-height:22px;color:#52525b;">Hi ${escapeHtml(e.contactName)},</p>
            <p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">${escapeHtml(e.prompt)}</p>
          </td></tr>
          <tr><td style="padding:24px 32px;">
            <a href="${url}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;line-height:1;padding:13px 22px;border-radius:8px;">Leave feedback</a>
          </td></tr>
          <tr><td style="padding:0 32px 8px 32px;">
            <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">Or paste this link into your browser:</p>
            <p style="margin:8px 0 0 0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${url}" style="color:#4f46e5;text-decoration:underline;">${url}</a></p>
          </td></tr>
          <tr><td style="padding:24px 32px 32px 32px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;line-height:18px;color:#a1a1aa;">
              This link is just for you and works until ${escapeHtml(expires)}. It only opens this one project &mdash; nothing else. If you weren&rsquo;t expecting it, you can ignore this email.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function buildText(e: FeedbackEmail): string {
  return [
    `Your feedback on ${e.projectName}`,
    '',
    `Hi ${e.contactName},`,
    '',
    e.prompt,
    '',
    e.url,
    '',
    `This link is just for you and works until ${e.expiresAt.toDateString()}.`,
    'It only opens this one project.',
  ].join('\n')
}

export async function sendFeedbackRequestEmail(e: FeedbackEmail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error(
      'Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL before requesting feedback.',
    )
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [e.to],
      subject: `Your feedback on ${e.projectName}`,
      html: buildHtml(e),
      text: buildText(e),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // Deliberately does not include the body of the request, which holds the URL.
    throw new Error(`Resend rejected the message (${res.status}). ${detail.slice(0, 200)}`)
  }
}
