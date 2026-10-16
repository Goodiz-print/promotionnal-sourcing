import { createHash } from 'node:crypto'

/**
 * Clé d'idempotence d'un appel IA : sha256 d'une sérialisation JSON stable
 * (clés triées) des entrées qui déterminent le résultat. Même entrées → même
 * clé, quel que soit l'ordre des propriétés.
 */
export function idempotencyKey(parts: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(parts)).digest('hex')
}

/** Hash sha256 d'un texte (hash du texte source dans une clé d'idempotence). */
export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
