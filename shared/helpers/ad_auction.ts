import { AD_MIN_CPC_CENTS, type AdAuctionCandidate, type AdAuctionWinner } from '../types/ads.js'

/**
 * Enchère au **second prix** entre campagnes éligibles (cf. `docs/ads.md`).
 *
 * - classement par enchère décroissante ; à égalité, la campagne la plus
 *   ancienne (identifiant le plus petit) passe devant — résultat déterministe ;
 * - **un seul emplacement par organisation** : un annonceur n'occupe pas tout
 *   l'écran, et n'enchérit jamais contre lui-même ;
 * - chaque gagnant paie l'enchère du candidat classé juste derrière lui, plus un
 *   centime, bornée par le prix plancher et par sa propre enchère maximale. Seul
 *   en lice, il paie le prix plancher.
 *
 * Fonction pure : l'éligibilité (statut, dates, budget, solde, pertinence) est
 * décidée en amont.
 */
export function runAdAuction(
  candidates: readonly AdAuctionCandidate[],
  slots: number
): AdAuctionWinner[] {
  const ranked = [...candidates].sort(
    (a, b) => b.maxCpcCents - a.maxCpcCents || a.campaignId - b.campaignId
  )

  const seen = new Set<number>()
  const contenders = ranked.filter((candidate) => {
    if (seen.has(candidate.organizationId)) return false
    seen.add(candidate.organizationId)
    return true
  })

  return contenders.slice(0, Math.max(0, slots)).map((winner, index) => {
    const next = contenders[index + 1]
    const price = next ? next.maxCpcCents + 1 : AD_MIN_CPC_CENTS
    return {
      ...winner,
      costCents: Math.min(winner.maxCpcCents, Math.max(AD_MIN_CPC_CENTS, price)),
    }
  })
}
