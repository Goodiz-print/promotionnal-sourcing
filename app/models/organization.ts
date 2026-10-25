import { hasMany, hasOne, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import { OrganizationSchema } from '#database/schema'
import type { AgencyReviewReason } from '#shared/types/agency_signup'
import OrganizationUser from '#models/organization_user'
import Supplier from '#models/supplier'
import SupplierProfile from '#models/supplier_profile'
import User from '#models/user'
import OrganizationDocument from '#models/organization_document'
import AgencyProfile from '#models/agency_profile'
import BillingProfile from '#models/billing_profile'
import Category from '#models/category'
import LegalConsent from '#models/legal_consent'
import SupplierContact from '#models/supplier_contact'
import SupplierNews from '#models/supplier_news'
import SupplierTradeShow from '#models/supplier_trade_show'
import type {
  OrganizationKind,
  OrganizationSize,
  SubscriptionPlan,
} from '#shared/types/organization'

export default class Organization extends OrganizationSchema {
  static table = 'organizations'

  declare size: OrganizationSize | null
  declare organizationType: OrganizationKind
  declare subscriptionPlan: SubscriptionPlan
  declare reviewReasons: AgencyReviewReason[]

  @hasMany(() => OrganizationUser)
  declare organizationUsers: HasMany<typeof OrganizationUser>

  @manyToMany(() => User, {
    pivotTable: 'organization_users',
    pivotColumns: ['role_id', 'joined_at'],
    pivotTimestamps: false,
  })
  declare users: ManyToMany<typeof User>

  @hasOne(() => SupplierProfile)
  declare supplierProfile: HasOne<typeof SupplierProfile>

  @hasMany(() => Supplier)
  declare suppliers: HasMany<typeof Supplier>

  @hasMany(() => OrganizationDocument)
  declare documents: HasMany<typeof OrganizationDocument>

  @hasOne(() => AgencyProfile)
  declare agencyProfile: HasOne<typeof AgencyProfile>

  @hasOne(() => BillingProfile)
  declare billingProfile: HasOne<typeof BillingProfile>

  @hasMany(() => LegalConsent)
  declare legalConsents: HasMany<typeof LegalConsent>

  @hasMany(() => SupplierContact)
  declare contacts: HasMany<typeof SupplierContact>

  @hasMany(() => SupplierNews)
  declare news: HasMany<typeof SupplierNews>

  @hasMany(() => SupplierTradeShow)
  declare tradeShows: HasMany<typeof SupplierTradeShow>

  /** Spécialités d'un fournisseur, choisies dans l'arbre de catégories. */
  @manyToMany(() => Category, {
    pivotTable: 'organization_categories',
    pivotTimestamps: false,
  })
  declare specialties: ManyToMany<typeof Category>

  /** Fournisseurs favoris d'une agence. */
  @manyToMany(() => Supplier, {
    pivotTable: 'agency_favorite_suppliers',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare favoriteSuppliers: ManyToMany<typeof Supplier>
}
