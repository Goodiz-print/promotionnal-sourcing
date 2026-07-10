import type Supplier from '#models/supplier'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'

export default class SupplierTransformer extends BaseTransformer<Supplier> {
  constructor(
    resource: Supplier,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject() {
    const translation = resolveTranslation(this.resource.translations, this.locale)

    return {
      ...this.pick(this.resource, [
        'id',
        'slug',
        'country',
        'website',
        'email',
        'phone',
        'logoUrl',
        'isActive',
        'createdAt',
        'updatedAt',
      ]),
      name: translation?.name ?? null,
      description: translation?.description ?? null,
    }
  }
}
