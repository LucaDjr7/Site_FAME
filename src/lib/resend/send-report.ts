import { Resend } from 'resend'
import { escapeHtml } from './escape-html'

const FROM = process.env.EMAIL_FROM ?? 'FAME <noreply@fame-lab.eu>'

export async function sendReportEmail(opts: { message: string; fromEmail?: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const to = process.env.REPORT_EMAIL
  if (!key || !to) {
    console.warn('RESEND_API_KEY or REPORT_EMAIL not set — skipping report email')
    return
  }
  const safeMsg = escapeHtml(opts.message)
  const safeFrom = opts.fromEmail ? escapeHtml(opts.fromEmail) : null
  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'FAME — problème signalé',
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2f4486;">Signalement</h2>
        <p style="white-space:pre-wrap;">${safeMsg}</p>
        ${safeFrom ? `<p style="color:#888;font-size:12px;">De : ${safeFrom}</p>` : ''}
      </div>
    `,
  })
  if (error) throw new Error(error.message ?? 'Resend send failed')
}
