import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierProfileSchema } from '#database/schema'
import Organization from '#models/organization'
import type {
  CatalogueSourceFormat,
  CatalogueUpdateFrequency,
  CatalogueUpdateMode,
  DefaultOriginScope,
  DeliveryScope,
  ReportFrequency,
  SupplierCommercialStatus,
  SupplierCompanyType,
} from '#shared/types/organization'

export default class SupplierProfile extends SupplierProfileSchema {
  static table = 'supplier_profiles'

  declare deliveryScope: DeliveryScope | null
  declare certifications: string[] | null
  declare deliveryCountries: string[] | null
  declare spokenLanguages: string[] | null
  declare companyType: SupplierCompanyType | null
  declare reportFrequency: ReportFrequency
  declare catalogueUpdateMode: CatalogueUpdateMode | null
  declare catalogueUpdateFrequency: CatalogueUpdateFrequency | null
  declare commercialStatus: SupplierCommercialStatus
  declare catalogueSourceFormat: CatalogueSourceFormat | null
  /** Provenance par défaut déclarée par le fournisseur (écart 9). */
  declare defaultOriginScope: DefaultOriginScope | null

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
