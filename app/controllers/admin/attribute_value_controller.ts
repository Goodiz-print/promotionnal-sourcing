import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AttributeService from '#services/attribute_service'
import {
  AttributeNotFoundException,
  AttributeValueInUseException,
  AttributeValueNotFoundException,
} from '#exceptions/catalogue_errors'
import { createAttributeValueValidator, updateAttributeValueValidator } from '#validators/attribute'

/**
 * Valeurs d'une facette (#48), éditées en ligne dans l'écran d'édition de
 * l'attribut : chaque action revient sur cet écran. Réservé à l'admin
 * plateforme (ability `canManageAttributes`).
 */
@inject()
export default class AttributeValueController {
  constructor(private service: AttributeService) {}

  async store({ bouncer, request, response, params, i18n, session }: HttpContext) {
    await bouncer.authorize('canManageAttributes')

    const attribute = await this.service.findById(Number(params.id))
    if (!attribute) throw new AttributeNotFoundException()

    const payload = await request.validateUsing(createAttributeValueValidator)
    await this.service.createValue(attribute, payload)

    session.flash('success', i18n.t('attributes.flash.valueCreated'))
    return response.redirect().back()
  }

  async update({ bouncer, request, response, params, i18n, session }: HttpContext) {
    await bouncer.authorize('canManageAttributes')

    const value = await this.findValue(params.id, params.valueId)
    const payload = await request.validateUsing(updateAttributeValueValidator)
    await this.service.updateValue(value, payload)

    session.flash('success', i18n.t('attributes.flash.valueUpdated'))
    return response.redirect().back()
  }

  /**
   * Supprime la valeur. Refusée si des produits la portent ou si des nuances lui
   * sont rattachées (flash d'erreur + retour arrière).
   */
  async destroy({ bouncer, response, params, i18n, session }: HttpContext) {
    await bouncer.authorize('canManageAttributes')

    const value = await this.findValue(params.id, params.valueId)

    try {
      await this.service.deleteValue(value)
    } catch (error) {
      if (!(error instanceof AttributeValueInUseException)) throw error
      session.flash('error', i18n.t(`attributes.flash.valueInUse.${error.reason}`))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('attributes.flash.valueDeleted'))
    return response.redirect().back()
  }

  private async findValue(attributeId: string, valueId: string) {
    const attribute = await this.service.findById(Number(attributeId))
    if (!attribute) throw new AttributeNotFoundException()

    const value = await this.service.findValue(attribute, Number(valueId))
    if (!value) throw new AttributeValueNotFoundException()
    return value
  }
}
