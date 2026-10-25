import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { AgencyProfileFactory } from '#database/factories/agency_profile_factory'
import { LegalConsentFactory } from '#database/factories/legal_consent_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { SupplierContactFactory } from '#database/factories/supplier_contact_factory'
import Category from '#models/category'
import Organization from '#models/organization'
import Supplier from '#models/supplier'
import SupplierProfile from '#models/supplier_profile'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import OrganizationTransformer from '#transformers/organization_transformer'
import { useDatabase } from '#tests/utils/setup'

test.group('Comptes — profils agence et fournisseur enrichis', (group) => {
  useDatabase(group, { seed: 'none' })

  test("une organisation démarre sur l'abonnement gratuit, en français, TVA non vérifiée", async ({
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    await org.refresh()

    assert.equal(org.subscriptionPlan, 'free')
    assert.equal(org.locale, 'fr')
    assert.isNull(org.vatVerifiedAt)

    const dto = new OrganizationTransformer(org).toObject()
    assert.equal(dto.subscriptionPlan, 'free')
    assert.isNull(dto.vatVerifiedAt)
  })

  test("le profil d'agence porte l'activité, les secteurs et la marge par défaut", async ({
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    await AgencyProfileFactory.merge({
      organizationId: org.id,
      teamSize: 'from_2_to_10',
      clientSectors: ['public_bodies', 'key_accounts'],
      defaultMarginPercent: 35 as unknown as string,
    }).create()

    const loaded = await Organization.query()
      .where('id', org.id)
      .preload('agencyProfile')
      .firstOrFail()
    assert.equal(loaded.agencyProfile.activity, 'object_communication_agency')
    assert.deepEqual(loaded.agencyProfile.clientSectors, ['public_bodies', 'key_accounts'])
    assert.equal(Number(loaded.agencyProfile.defaultMarginPercent), 35)
  })

  test("le profil d'agence refuse une activité hors liste", async ({ assert }) => {
    const org = await OrganizationFactory.create()
    await assert.rejects(() =>
      AgencyProfileFactory.merge({
        organizationId: org.id,
        activity: 'plombier' as never,
      }).create()
    )
  })

  test('le journal des consentements garde version, IP et date, par organisation', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    await LegalConsentFactory.merge({ organizationId: org.id, kind: 'terms' }).create()
    await LegalConsentFactory.merge({
      organizationId: org.id,
      kind: 'partner_communications',
      revokedAt: DateTime.now(),
    }).create()

    const loaded = await Organization.query()
      .where('id', org.id)
      .preload('legalConsents')
      .firstOrFail()
    assert.lengthOf(loaded.legalConsents, 2)
    const terms = loaded.legalConsents.find((consent) => consent.kind === 'terms')!
    assert.equal(terms.version, '2026-10-19')
    assert.equal(terms.ipAddress, '203.0.113.7')
    assert.isNull(terms.revokedAt)
  })

  test('un fournisseur a des contacts, des spécialités et une valeur par défaut de rapport', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    const profile = await SupplierProfile.create({ organizationId: org.id })
    await profile.refresh()
    assert.equal(profile.commercialStatus, 'prospect')
    assert.equal(profile.reportFrequency, 'none')
    assert.isFalse(profile.isFoundingPartner)

    await SupplierContactFactory.merge({ organizationId: org.id, languages: ['fr'] }).create()
    const category = await Category.create({ slug: 'jeux-de-cartes' } as never)
    await org.related('specialties').attach([category.id])

    const loaded = await Organization.query()
      .where('id', org.id)
      .preload('contacts')
      .preload('specialties')
      .firstOrFail()
    assert.lengthOf(loaded.contacts, 1)
    assert.deepEqual(loaded.contacts[0].languages, ['fr'])
    assert.deepEqual(
      loaded.specialties.map((c) => c.id),
      [category.id]
    )
  })

  test("le transformer du profil fournisseur n'expose jamais le suivi commercial interne", async ({
    assert,
  }) => {
    const org = await OrganizationFactory.apply('supplier').create()
    const profile = await SupplierProfile.create({
      organizationId: org.id,
      internalNotes: 'Négociation en cours',
      commercialStatus: 'followed_up',
      primaryContactEmail: 'contact@example.com',
      isFoundingPartner: true,
      foundingPartnerUntil: DateTime.fromISO('2027-06-30'),
    })
    await profile.refresh()

    const dto = new SupplierProfileTransformer(profile).toObject() as Record<string, unknown>
    assert.notProperty(dto, 'internalNotes')
    assert.notProperty(dto, 'commercialStatus')
    assert.notProperty(dto, 'primaryContactEmail')
    assert.isTrue(dto.isFoundingPartner as boolean)
    assert.equal(dto.foundingPartnerUntil, '2027-06-30')
  })

  test('les agences gardent leurs fournisseurs favoris', async ({ assert }) => {
    const agency = await OrganizationFactory.create()
    const supplier = await Supplier.create({ slug: 'abeilles', country: 'FR' })
    await agency.related('favoriteSuppliers').attach([supplier.id])

    const loaded = await Organization.query()
      .where('id', agency.id)
      .preload('favoriteSuppliers')
      .firstOrFail()
    assert.deepEqual(
      loaded.favoriteSuppliers.map((s) => s.slug),
      ['abeilles']
    )
  })
})
