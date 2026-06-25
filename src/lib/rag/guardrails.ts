const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

export function maskPII(text: string): string {
  return text.replace(EMAIL_RE, '[redacted]')
}

const INJECTION_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /ignore (your|the|all) (previous |prior )?(instructions|rules)/i, reason: 'ignore-instructions' },
  { re: /system prompt/i, reason: 'system-prompt-extraction' },
  { re: /\bjailbreak\b/i, reason: 'jailbreak' },
  { re: /pretend (you are|to be)|act as (an?|if)/i, reason: 'roleplay' },
  { re: /reveal (your|the) (prompt|instructions|rules)/i, reason: 'reveal-prompt' },
]

export function detectInjection(text: string): { flagged: boolean; reason?: string } {
  for (const { re, reason } of INJECTION_PATTERNS) {
    if (re.test(text)) return { flagged: true, reason }
  }
  return { flagged: false }
}
