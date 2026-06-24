// Renvoie l'URL de base publique de l'app (pour construire des liens absolus
// dans les emails). Lève si NEXT_PUBLIC_APP_URL n'est pas configurée, pour
// éviter d'envoyer des liens d'activation relatifs (donc inutilisables).
export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base || base.trim() === '') {
    throw new Error('NEXT_PUBLIC_APP_URL is not set')
  }
  return base.replace(/\/+$/, '')
}
