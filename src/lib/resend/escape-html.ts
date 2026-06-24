// Échappe les caractères HTML pour interpolation sûre dans les templates email.
// L'ordre importe : '&' d'abord pour ne pas doubler les entités.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
