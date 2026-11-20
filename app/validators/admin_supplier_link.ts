import vine from '@vinejs/vine'
import { SUPPLIER_LINK_FILTERS } from '#shared/types/supplier_link'

/** Filtres de l'écran de rattachement des fiches fournisseur (query string). */
export const supplierLinkFiltersValidator = vine.create({
  status: vine.enum(SUPPLIER_LINK_FILTERS).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/** Rattachement d'une fiche : l'organisation fournisseur choisie par l'admin. */
export const supplierLinkValidator = vine.create({
  organizationId: vine.number().withoutDecimals().min(1),
})
