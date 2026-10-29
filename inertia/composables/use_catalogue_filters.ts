import { computed, reactive } from 'vue'
import type { OriginZone, ProductDirectoryFilters, ProductStockStatus } from '#shared/types/product'

/** Interrupteurs booléens transverses du catalogue (made-in-Europe, nouveautés, éco). */
export const CATALOGUE_FLAGS = ['madeInEurope', 'newOnly', 'ecoOnly'] as const

export type CatalogueFlag = (typeof CATALOGUE_FLAGS)[number]

/** Facettes à sélection multiple : non vides = filtre actif. */
const LIST_KEYS = [
  'attributeValueIds',
  'certificationIds',
  'originZones',
  'stockStatuses',
  'priceBuckets',
  'moqBuckets',
  'attributeRanges',
] as const

/** Catalogue sans aucun filtre : cible du bouton « Réinitialiser ». */
export const EMPTY_CATALOGUE_FILTERS: ProductDirectoryFilters = {
  search: null,
  categoryId: null,
  madeInEurope: false,
  attributeValueIds: [],
  certificationIds: [],
  originZones: [],
  stockStatuses: [],
  priceBuckets: [],
  moqBuckets: [],
  attributeRanges: [],
  newOnly: false,
  ecoOnly: false,
}

/** Copie profonde (tableaux et tranches) : l'état local ne partage rien avec les props. */
export function cloneCatalogueFilters(filters: ProductDirectoryFilters): ProductDirectoryFilters {
  return {
    ...filters,
    attributeValueIds: [...filters.attributeValueIds],
    certificationIds: [...filters.certificationIds],
    originZones: [...filters.originZones],
    stockStatuses: [...filters.stockStatuses],
    priceBuckets: [...filters.priceBuckets],
    moqBuckets: [...filters.moqBuckets],
    attributeRanges: filters.attributeRanges.map((range) => ({ ...range })),
  }
}

/**
 * État local de la barre de filtres du catalogue. La barre est pilotée
 * localement puis remonte l'état complet via `onApply` (recherche debouncée, le
 * reste immédiat). Chaque facette expose son handler de coche / décoche.
 */
export function useCatalogueFilters(
  initial: ProductDirectoryFilters,
  onApply: (filters: ProductDirectoryFilters) => void
) {
  const state = reactive<ProductDirectoryFilters>(cloneCatalogueFilters(initial))

  const hasActiveFilters = computed(
    () =>
      Boolean(state.search) ||
      state.categoryId !== null ||
      CATALOGUE_FLAGS.some((flag) => state[flag]) ||
      LIST_KEYS.some((key) => state[key].length > 0)
  )

  function apply() {
    onApply(cloneCatalogueFilters(state))
  }

  let debounce: ReturnType<typeof setTimeout> | undefined
  function onSearch(value: string | null) {
    state.search = value || null
    clearTimeout(debounce)
    debounce = setTimeout(apply, 300)
  }

  function onCategory(value: string | null) {
    state.categoryId = value ? Number(value) : null
    // Les facettes dépendent de la catégorie : on repart d'une sélection vide pour
    // ne pas garder des valeurs/tranches qui n'appartiennent pas à la nouvelle catégorie.
    state.attributeValueIds = []
    state.attributeRanges = []
    apply()
  }

  function setFlag(key: CatalogueFlag, value: boolean) {
    state[key] = value
    apply()
  }

  function toggleOriginZone(zone: OriginZone, checked: boolean) {
    state.originZones = checked
      ? [...state.originZones, zone]
      : state.originZones.filter((value) => value !== zone)
    apply()
  }

  function toggleStockStatus(status: ProductStockStatus, checked: boolean) {
    state.stockStatuses = checked
      ? [...state.stockStatuses, status]
      : state.stockStatuses.filter((value) => value !== status)
    apply()
  }

  function toggleValue(valueId: number, checked: boolean) {
    state.attributeValueIds = checked
      ? [...state.attributeValueIds, valueId]
      : state.attributeValueIds.filter((id) => id !== valueId)
    apply()
  }

  function toggleCertification(certificationId: number, checked: boolean) {
    state.certificationIds = checked
      ? [...state.certificationIds, certificationId]
      : state.certificationIds.filter((id) => id !== certificationId)
    apply()
  }

  // Buckets prix / MOQ (plan L125) : liste d'index cochés dans la liste fermée partagée.
  function toggleBucket(key: 'priceBuckets' | 'moqBuckets', index: number, checked: boolean) {
    state[key] = checked ? [...state[key], index] : state[key].filter((value) => value !== index)
    apply()
  }

  // Tranche d'attribut EAV (plan L125) : identifiée par slug + bornes `[min, max[`.
  function toggleAttributeRange(
    slug: string,
    minValue: number | null,
    maxValue: number | null,
    checked: boolean
  ) {
    state.attributeRanges = checked
      ? [...state.attributeRanges, { slug, minValue, maxValue }]
      : state.attributeRanges.filter(
          (range) =>
            !(range.slug === slug && range.minValue === minValue && range.maxValue === maxValue)
        )
    apply()
  }

  /** Vide tous les filtres (recherche comprise) et recharge le catalogue. */
  function reset() {
    clearTimeout(debounce)
    Object.assign(state, cloneCatalogueFilters(EMPTY_CATALOGUE_FILTERS))
    apply()
  }

  return {
    state,
    hasActiveFilters,
    onSearch,
    onCategory,
    setFlag,
    toggleOriginZone,
    toggleStockStatus,
    toggleValue,
    toggleCertification,
    toggleBucket,
    toggleAttributeRange,
    reset,
  }
}
