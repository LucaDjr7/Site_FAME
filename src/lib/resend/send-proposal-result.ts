import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM ?? 'FAME <noreply@fame-lab.eu>'

export async function sendProposalResultEmail(opts: {
  to: string
  proposantPrenom: string
  titreProposal: string
  statut: 'accepted' | 'rejected'
  commentaire?: string | null
}) {
  const { to, proposantPrenom, titreProposal, statut, commentaire } = opts
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('RESEND_API_KEY not set — skipping proposal result email')
    return
  }
  const accepted = statut === 'accepted'
  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your FAME proposal: ${accepted ? 'accepted ✓' : 'not retained'}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2f4486;">Hello ${proposantPrenom},</h2>
        <p>We have reviewed your research proposal: <strong>${titreProposal}</strong>.</p>
        ${accepted
          ? '<p>We are pleased to let you know that your proposal has been <strong style="color:#1e9b7e;">accepted</strong> by the team. We may reach out to you soon.</p>'
          : '<p>After review, we regret that we are unable to retain your proposal at this time.</p>'
        }
        ${commentaire ? `<p><em>Team note: ${commentaire}</em></p>` : ''}
        <p style="color:#888;font-size:12px;">Thank you for your interest in FAME research.</p>
      </div>
    `,
  })
  if (error) throw new Error(error.message ?? 'Resend send failed')
}
