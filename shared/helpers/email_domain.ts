/**
 * Messageries grand public : une adresse chez l'un de ces fournisseurs ne prouve
 * pas l'appartenance à l'entreprise, l'inscription passe en validation manuelle.
 */
export const FREE_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'icloud.com',
  'me.com',
  'aol.com',
  'gmx.com',
  'gmx.de',
  'web.de',
  'proton.me',
  'protonmail.com',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'neuf.fr',
  'laposte.net',
  'bbox.fr',
  'yandex.com',
  'mail.com',
] as const

export function emailDomain(email: string): string {
  return email
    .slice(email.lastIndexOf('@') + 1)
    .trim()
    .toLowerCase()
}

export function isFreeEmailDomain(email: string): boolean {
  return (FREE_EMAIL_DOMAINS as readonly string[]).includes(emailDomain(email))
}

/** Hôte d'un site web saisi avec ou sans schéma, sans `www.` ; `null` si illisible. */
export function websiteHost(website: string): string | null {
  const value = website.trim()
  if (!value) return null
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

/**
 * Le domaine de l'email est celui du site web, ou l'un de ses sous-domaines
 * (`marie@mail.agence.fr` pour `agence.fr`).
 */
export function emailMatchesWebsite(email: string, website: string): boolean {
  const host = websiteHost(website)
  if (!host) return false
  const domain = emailDomain(email)
  return domain === host || domain.endsWith(`.${host}`)
}
