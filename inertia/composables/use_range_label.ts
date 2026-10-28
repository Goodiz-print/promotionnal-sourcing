import { useI18n } from '~/i18n'

/**
 * Libellé d'une tranche numérique `[min, max[` (plan L125), rendu depuis les
 * bornes + un suffixe d'unité / devise + la locale — jamais stocké. Partagé par
 * les tranches d'attributs EAV (`facet_group.vue`) et les buckets prix / MOQ
 * (`numeric_facet_group.vue`) pour ne pas dupliquer la logique (CLAUDE.md).
 *
 * `suffix` est l'unité ou la devise (`« ml »`, `« € »`, `« pcs »`) ; vide = aucun.
 * Une borne `null` est ouverte (`< max`, `≥ min`).
 */
export function useRangeLabel() {
  const { t } = useI18n()

  return function rangeLabel(
    minValue: number | null,
    maxValue: number | null,
    suffix = ''
  ): string {
    const unit = suffix ? ` ${suffix}` : ''
    if (minValue !== null && maxValue !== null) {
      return t('products.index.rangeBetween', { min: minValue, max: maxValue }) + unit
    }
    if (maxValue !== null) {
      return t('products.index.rangeUnder', { max: maxValue }) + unit
    }
    if (minValue !== null) {
      return t('products.index.rangeOver', { min: minValue }) + unit
    }
    return unit.trim()
  }
}
