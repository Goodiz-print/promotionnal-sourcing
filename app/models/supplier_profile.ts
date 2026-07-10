import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierProfileSchema } from '#database/schema'
import Organization from '#models/organization'
import type { DeliveryScope } from '#shared/types/organization'

export default class SupplierProfile extends SupplierProfileSchema {
  static table = 'supplier_profiles'

  declare deliveryScope: DeliveryScope | null
  declare certifications: string[] | null

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
