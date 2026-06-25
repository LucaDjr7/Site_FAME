import { Resend } from 'resend'
import { escapeHtml } from './escape-html'
import { LAB_LABELS } from '@/lib/constants'
import type { Lab } from '@/types'

const FROM = process.env.EMAIL_FROM ?? 'FAME <noreply@fame-lab.eu>'

export async function sendInvitationEmail(opts: {
  to: string
  prenom: string
  activationUrl: string
  lab: string
}) {
  const { to, prenom, activationUrl, lab } = opts
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('RESEND_API_KEY not set — skipping invitation email')
    return
  }
  const labLabel = LAB_LABELS[lab as Lab] ?? lab
  const safePrenom = escapeHtml(prenom)
  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `You're invited to join FAME ${labLabel}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2f4486;">Welcome to FAME, ${safePrenom}!</h2>
        <p>You have been invited to join the FAME research team (${labLabel} lab).</p>
        <p>Click the link below to activate your account and set your password:</p>
        <a href="${activationUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2f4486;color:white;border-radius:6px;text-decoration:none;font-family:monospace;">
          Activate my account &rarr;
        </a>
        <p style="color:#888;font-size:12px;">This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
      </div>
    `,
  })
  if (error) throw new Error(error.message ?? 'Resend send failed')
}
