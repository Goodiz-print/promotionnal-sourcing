import type { CategoryAttributeRangeInput } from '#shared/types/category'

/** Plage en cours d'édition : champs vides = borne ouverte. */
export interface RangeDraft {
  minValue: string
  maxValue: string
}

/** Brouillons initiaux à partir des plages enregistrées. */
export function toDrafts(ranges: CategoryAttributeRangeInput[]): RangeDraft[] {
  return ranges.map((range) => ({
    minValue: range.minValue === null || range.minValue === undefined ? '' : String(range.minValue),
    maxValue: range.maxValue === null || range.maxValue === undefined ? '' : String(range.maxValue),
  }))
}

function parseBound(raw: string): number | null {
  const trimmed = raw.trim()
  return trimmed === '' ? null : Number(trimmed)
}

/** Charge utile : borne vide -> `null` (ouverte), plage entièrement vide ignorée. */
export function fromDrafts(drafts: RangeDraft[]): { ranges: CategoryAttributeRangeInput[] } {
  const ranges = drafts
    .map((draft) => ({
      minValue: parseBound(draft.minValue),
      maxValue: parseBound(draft.maxValue),
    }))
    .filter((range) => range.minValue !== null || range.maxValue !== null)
  return { ranges }
}

/** Libellé court d'une plage : `400 – 600 ml`, `< 400 ml`, `> 900 ml`. */
export function formatRange(range: CategoryAttributeRangeInput, unit: string | null): string {
  const suffix = unit ? ` ${unit}` : ''
  const minValue = range.minValue ?? null
  const maxValue = range.maxValue ?? null
  if (minValue === null && maxValue === null) return '–'
  if (minValue === null) return `< ${maxValue}${suffix}`
  if (maxValue === null) return `> ${minValue}${suffix}`
  return `${minValue} – ${maxValue}${suffix}`
}
