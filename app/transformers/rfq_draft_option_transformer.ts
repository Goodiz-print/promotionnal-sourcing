import { BaseTransformer } from '@adonisjs/core/transformers'
import type Rfq from '#models/rfq'
import type { RfqDraftOptionType } from '#shared/types/rfq'

/**
 * Brouillon réduit à ce que le menu « ajouter à une demande » d'une fiche
 * produit affiche.
 */
export default class RfqDraftOptionTransformer extends BaseTransformer<Rfq> {
  toObject(): RfqDraftOptionType {
    return this.pick(this.resource, ['id', 'title'])
  }
}
