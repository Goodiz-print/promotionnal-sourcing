import { emailDomain, isFreeEmailDomain, websiteHost } from '#shared/helpers/email_domain'
import type {
  SupplierLinkCandidate,
  SupplierLinkContact,
  SupplierLinkMatch,
} from '#shared/types/supplier_link'

/**
 * Proposition automatique d'organisation pour une fiche importée (#231) :
 * calcul pur, sans base. Une adresse email identique (celle de l'organisation
 * ou d'un de ses membres) l'emporte sur un domaine commun ; les domaines de
 * messagerie grand public (gmail.com…) ne servent jamais de preuve.
 */
export function suggestOrganization(
  contact: SupplierLinkContact,
  candidates: readonly SupplierLinkCandidate[]
): { candidate: SupplierLinkCandidate; match: SupplierLinkMatch } | null {
  const email = normalizeEmail(contact.email)
  const byEmail = email ? candidates.find((candidate) => hasEmail(candidate, email)) : undefined
  if (byEmail) return { candidate: byEmail, match: 'email' }

  const domains = contactDomains(contact)
  if (domains.length === 0) return null

  const byDomain = candidates.find((candidate) =>
    candidateDomains(candidate).some((domain) => domains.some((own) => sameDomain(own, domain)))
  )
  return byDomain ? { candidate: byDomain, match: 'domain' } : null
}

function normalizeEmail(email: string | null): string | null {
  const value = email?.trim().toLowerCase()
  return value?.includes('@') ? value : null
}

function hasEmail(candidate: SupplierLinkCandidate, email: string): boolean {
  return [candidate.email, ...candidate.memberEmails].some(
    (value) => normalizeEmail(value) === email
  )
}

/** Domaine professionnel d'un email, `null` s'il est grand public ou illisible. */
function businessDomain(email: string | null): string | null {
  const value = normalizeEmail(email)
  if (!value || isFreeEmailDomain(value)) return null
  return emailDomain(value) || null
}

function domainsOf(emails: (string | null)[], website: string | null): string[] {
  const hosts = [...emails.map(businessDomain), website ? websiteHost(website) : null]
  return [...new Set(hosts.filter((host): host is string => host !== null))]
}

function contactDomains(contact: SupplierLinkContact): string[] {
  return domainsOf([contact.email], contact.website)
}

function candidateDomains(candidate: SupplierLinkCandidate): string[] {
  return domainsOf([candidate.email, ...candidate.memberEmails], candidate.website)
}

/** Même domaine, ou l'un est un sous-domaine de l'autre (`fr.makito.es` / `makito.es`). */
function sameDomain(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}
