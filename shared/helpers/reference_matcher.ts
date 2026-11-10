import { normalizeLabel } from '#shared/helpers/supplier_feed'
import type { ReferenceEntry } from '#shared/types/supplier_feed'

/** Pluriels simples (`stylos` → `stylo`, `chapeaux` → `chapeau`) pour un rapprochement tolérant. */
function stem(token: string): string {
  if (token.length > 3 && (token.endsWith('s') || token.endsWith('x'))) return token.slice(0, -1)
  return token
}

function phrase(value: string): string {
  return normalizeLabel(value).split(' ').filter(Boolean).map(stem).join(' ')
}

/**
 * Rapproche un libellé brut de fournisseur (« Stylos à bille > Plastique »,
 * « Bleu marine 02 », « SERIGRAPHIE ou TAMPOGRAPHIE ») d'une entrée de
 * référentiel par ses libellés connus : correspondance de **mots entiers**,
 * insensible à la casse, aux accents et aux pluriels simples. Le libellé connu
 * le plus long l'emporte (« bleu marine » avant « bleu »), puis la `priority`.
 * Rien d'inventé : sans correspondance, `null`.
 */
export default class ReferenceMatcher {
  private labels: { phrase: string; id: number; priority: number }[]

  constructor(entries: ReferenceEntry[]) {
    this.labels = entries
      .flatMap((entry) =>
        entry.labels.map((label) => ({
          phrase: phrase(label),
          id: entry.id,
          priority: entry.priority,
        }))
      )
      .filter((label) => label.phrase.length >= 2)
      .sort((a, b) => b.phrase.length - a.phrase.length || b.priority - a.priority)
  }

  match(raw: string | null | undefined): number | null {
    if (!raw) return null
    const haystack = ` ${phrase(raw)} `
    return this.labels.find((label) => haystack.includes(` ${label.phrase} `))?.id ?? null
  }

  /**
   * Entrée la mieux couverte : chaque libellé distinct reconnu ajoute sa
   * longueur au score de son entrée. Adapté aux référentiels à synonymes
   * génériques (catégories : « maison », « cuisine », « plaids »…), où un seul
   * mot ne suffit pas à trancher. Égalité : `priority`, puis premier rencontré.
   */
  best(raw: string | null | undefined): number | null {
    if (!raw) return null
    const haystack = ` ${phrase(raw)} `
    const scores = new Map<number, { score: number; priority: number }>()
    const counted = new Set<string>()
    for (const label of this.labels) {
      const key = `${label.id}:${label.phrase}`
      if (counted.has(key) || !haystack.includes(` ${label.phrase} `)) continue
      counted.add(key)
      const current = scores.get(label.id) ?? { score: 0, priority: label.priority }
      current.score += label.phrase.length
      scores.set(label.id, current)
    }
    let winner: { id: number; score: number; priority: number } | null = null
    for (const [id, { score, priority }] of scores) {
      if (
        !winner ||
        score > winner.score ||
        (score === winner.score && priority > winner.priority)
      ) {
        winner = { id, score, priority }
      }
    }
    return winner?.id ?? null
  }

  /** Toutes les entrées reconnues dans le libellé, dans l'ordre de spécificité. */
  matchAll(raw: string | null | undefined): number[] {
    if (!raw) return []
    let haystack = ` ${phrase(raw)} `
    const ids: number[] = []
    for (const label of this.labels) {
      const needle = ` ${label.phrase} `
      if (!haystack.includes(needle)) continue
      if (!ids.includes(label.id)) ids.push(label.id)
      // Le passage reconnu est consommé : « bleu marine » ne compte pas aussi « bleu ».
      haystack = haystack.replace(needle, '  ')
    }
    return ids
  }
}
