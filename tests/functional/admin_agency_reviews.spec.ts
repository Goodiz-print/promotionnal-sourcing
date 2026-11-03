import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import AgencyReviewDecisionNotification from '#mails/agency_review_decision_notification'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import AgencyProfile from '#models/agency_profile'
import AgencyReviewDecisionRecord from '#models/agency_review_decision'
import Organization from '#models/organization'
import AdminAgencyReviewService from '#services/admin_agency_review_service'
import OrganizationService from '#services/organization_service'
import { AgencyReviewClosedException } from '#exceptions/agency_review_errors'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AgencyReviewReason } from '#shared/types/agency_signup'

interface Item {
  id: number
  status: string
}

/** Agence inscrite avec ses motifs de revue (vide = validée à l'inscription) et son propriétaire. */
async function agency(reviewReasons: AgencyReviewReason[] = ['vat_unverified', 'no_website']) {
  const organization = await OrganizationFactory.merge({
    organizationType: 'buyer',
    reviewReasons,
  }).create()
  await AgencyProfile.create({
    organizationId: organization.id,
    activity: 'distributor_reseller',
  })
  const owner = await createMember(organization, 'owner')
  return { organization, owner }
}

async function queue(client: any, user: unknown, qs = '') {
  const response = await client.get(`/fr/admin/agency-reviews${qs}`).withInertia().loginAs(user)
  response.assertStatus(200)
  return response.inertiaProps as { queue: { data: Item[]; meta: { total: number } } }
}

/**
 * Toute décision met un mail en queue : sans faux mailer, le test tenterait un
 * vrai envoi SMTP (refusé en CI) et attendrait les relances de la queue.
 */
function fakeMails(group: Parameters<typeof useDatabase>[0]) {
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })
}

/** Décision par JSON : un refus (403), une validation (422) ou un conflit (409) gardent leur statut. */
function decide(client: any, user: unknown, id: number, body: Record<string, unknown>) {
  return client
    .post(`/fr/admin/agency-reviews/${id}/decision`)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
    .json(body)
}

test.group('Revue des agences — droits', (group) => {
  useDatabase(group)

  test('un admin et un modérateur accèdent à la file', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const moderator = await UserFactory.apply('platformModerator').create()

    for (const user of [admin, moderator]) {
      const response = await client.get('/fr/admin/agency-reviews').withInertia().loginAs(user)
      response.assertStatus(200)
      response.assertInertiaComponent('admin/agency_reviews/index')
    }
  })

  test('le support et l’analyste n’y accèdent pas, ni à la décision', async ({
    client,
    assert,
  }) => {
    const { organization } = await agency()

    for (const role of ['platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(role).create()
      const page = await client.get('/fr/admin/agency-reviews').withInertia().loginAs(user)
      page.assertStatus(403)
      const response = await decide(client, user, organization.id, { decision: 'approved' })
      response.assertStatus(403)
    }
    await organization.refresh()
    assert.deepEqual(organization.reviewReasons, ['vat_unverified', 'no_website'])
  })
})

test.group('Revue des agences — file', (group) => {
  useDatabase(group)
  fakeMails(group)

  test('liste les agences à revoir, pas celles validées à l’inscription ni les acheteurs sans profil agence', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization: toReview } = await agency()
    await agency([])
    await OrganizationFactory.merge({ reviewReasons: ['vat_unverified'] }).create()

    const { queue: result } = await queue(client, admin)

    assert.deepEqual(
      result.data.map((item) => item.id),
      [toReview.id]
    )
    assert.equal(result.data[0].status, 'pending')
    assert.equal(result.meta.total, 1)
  })

  test('une agence archivée sort de la file', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()
    await Organization.query().where('id', organization.id).update({ archived_at: new Date() })

    const { queue: result } = await queue(client, admin)
    assert.lengthOf(result.data, 0)
  })

  test('les filtres validées et rejetées suivent la dernière décision', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization: approved } = await agency()
    const { organization: rejected } = await agency()
    await decide(client, admin, approved.id, { decision: 'approved' })
    await decide(client, admin, rejected.id, { decision: 'rejected', reason: 'Pas une agence' })

    const open = await queue(client, admin)
    const validated = await queue(client, admin, '?status=approved')
    const refused = await queue(client, admin, '?status=rejected')

    assert.lengthOf(open.queue.data, 0)
    assert.deepEqual(
      validated.queue.data.map((item) => item.id),
      [approved.id]
    )
    assert.deepEqual(
      refused.queue.data.map((item) => item.id),
      [rejected.id]
    )
  })

  test('un filtre invalide est refusé', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const response = await client
      .get('/fr/admin/agency-reviews?status=nope')
      .withInertia()
      .redirects(0)
      .loginAs(admin)
    assert.equal(response.status(), 302)
  })

  test('la fiche expose motifs, contrôles, propriétaires et historique', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await agency(['domain_mismatch'])

    const response = await client
      .get(`/fr/admin/agency-reviews/${organization.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/agency_reviews/show')
    const { detail } = response.inertiaProps
    assert.deepEqual(detail.item.reasons, ['domain_mismatch'])
    assert.isNull(detail.item.vatVerifiedAt)
    assert.deepEqual(
      detail.owners.map((row: { email: string }) => row.email),
      [owner.email]
    )
    assert.isTrue(detail.canDecide)
    assert.lengthOf(detail.history, 0)
  })

  test('un identifiant non numérique renvoie 404, pas une erreur serveur', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const page = await client.get('/fr/admin/agency-reviews/abc').withInertia().loginAs(admin)
    page.assertStatus(404)
    const response = await decide(client, admin, 'abc' as unknown as number, {
      decision: 'approved',
    })
    response.assertStatus(404)
  })

  test('une organisation sans profil agence est introuvable', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await OrganizationFactory.merge({ reviewReasons: ['vat_unverified'] }).create()

    const response = await client
      .get(`/fr/admin/agency-reviews/${buyer.id}`)
      .withInertia()
      .loginAs(admin)
    response.assertStatus(404)
  })
})

test.group('Revue des agences — décisions', (group) => {
  useDatabase(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('valider lève les motifs, trace l’audit et prévient le propriétaire', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await agency()

    const response = await decide(client, admin, organization.id, { decision: 'approved' })

    assert.isAtLeast(response.status(), 302)
    assert.isBelow(response.status(), 400)
    await organization.refresh()
    assert.deepEqual(organization.reviewReasons, [])
    assert.isNull(organization.archivedAt)

    const record = await AgencyReviewDecisionRecord.query()
      .where('organizationId', organization.id)
      .firstOrFail()
    assert.equal(record.decision, 'approved')
    assert.equal(record.decidedByUserId, admin.id)
    assert.deepEqual(record.reviewReasons, ['vat_unverified', 'no_website'])

    const audit = await AdminAuditLog.query()
      .where('action', 'agency_review.approved')
      .firstOrFail()
    assert.equal(audit.targetType, 'organization')
    assert.equal(audit.targetId, organization.id)
    assert.equal(audit.actorEmail, admin.email)
    assert.deepEqual(audit.changes?.before, {
      status: 'pending',
      review_reasons: 'vat_unverified,no_website',
    })

    fakeMailer.mails.assertSent(AgencyReviewDecisionNotification, (sent) => {
      return (sent as unknown as { email: string }).email === owner.email
    })
  })

  test('rejeter exige un motif, archive l’organisation et le conserve', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()

    const missing = await decide(client, admin, organization.id, { decision: 'rejected' })
    missing.assertStatus(422)
    await organization.refresh()
    assert.isNull(organization.archivedAt)
    assert.lengthOf(await AgencyReviewDecisionRecord.all(), 0)
    assert.lengthOf(await AdminAuditLog.all(), 0)

    await decide(client, admin, organization.id, {
      decision: 'rejected',
      reason: 'Aucune activité de communication par l’objet',
    })

    await organization.refresh()
    assert.isNotNull(organization.archivedAt)
    const record = await AgencyReviewDecisionRecord.query().firstOrFail()
    assert.equal(record.decision, 'rejected')
    assert.equal(record.reason, 'Aucune activité de communication par l’objet')
    const audit = await AdminAuditLog.query()
      .where('action', 'agency_review.rejected')
      .firstOrFail()
    assert.equal(audit.changes?.after?.reason, 'Aucune activité de communication par l’objet')
    fakeMailer.mails.assertSent(AgencyReviewDecisionNotification)
  })

  test('demander des informations garde l’agence dans la file, avec le message', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()

    const missing = await decide(client, admin, organization.id, { decision: 'info_requested' })
    missing.assertStatus(422)

    await decide(client, admin, organization.id, {
      decision: 'info_requested',
      reason: 'Merci de joindre un extrait Kbis.',
    })

    const { queue: result } = await queue(client, admin)
    assert.deepEqual(
      result.data.map((item) => [item.id, item.status]),
      [[organization.id, 'info_requested']]
    )
    await organization.refresh()
    assert.deepEqual(organization.reviewReasons, ['vat_unverified', 'no_website'])
    assert.isNull(organization.archivedAt)
    fakeMailer.mails.assertSent(AgencyReviewDecisionNotification)
  })

  test('on peut valider une agence après une demande d’informations', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()
    await decide(client, admin, organization.id, { decision: 'info_requested', reason: 'Kbis ?' })

    await decide(client, admin, organization.id, { decision: 'approved' })

    const history = await AgencyReviewDecisionRecord.query().orderBy('id')
    assert.deepEqual(
      history.map((row) => row.decision),
      ['info_requested', 'approved']
    )
    const audit = await AdminAuditLog.query()
      .where('action', 'agency_review.approved')
      .firstOrFail()
    assert.equal(audit.changes?.before?.status, 'info_requested')
  })

  test('une agence déjà traitée refuse une nouvelle décision (409)', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()
    await decide(client, admin, organization.id, { decision: 'approved' })

    const again = await decide(client, admin, organization.id, {
      decision: 'rejected',
      reason: 'Trop tard',
    })

    again.assertStatus(409)
    assert.lengthOf(await AgencyReviewDecisionRecord.all(), 1)
    assert.lengthOf(await AdminAuditLog.all(), 1)
  })

  test('deux décisions simultanées sont sérialisées : une seule est enregistrée', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()
    const service = await app.container.make(AdminAgencyReviewService)
    const context = { actor: { id: admin.id, email: admin.email }, ip: '127.0.0.1' }

    const results = await Promise.allSettled([
      service.decide({
        organizationId: organization.id,
        decision: 'approved',
        reason: null,
        decidedBy: admin,
        context,
      }),
      service.decide({
        organizationId: organization.id,
        decision: 'rejected',
        reason: 'Doublon',
        decidedBy: admin,
        context,
      }),
    ])

    assert.lengthOf(
      results.filter((result) => result.status === 'fulfilled'),
      1
    )
    const refused = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    assert.instanceOf(refused.reason, AgencyReviewClosedException)
    assert.lengthOf(await AgencyReviewDecisionRecord.all(), 1)
    assert.lengthOf(await AdminAuditLog.all(), 1)
    fakeMailer.mails.assertSentCount(1)
  })

  test('un archivage qui échoue annule tout le rejet : décision, audit et mail', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()
    app.container.swap(OrganizationService, () => {
      return {
        archiveWithin: async () => {
          throw new Error('archive indisponible')
        },
        notifyArchived: async () => {},
      } as unknown as OrganizationService
    })

    try {
      const response = await decide(client, admin, organization.id, {
        decision: 'rejected',
        reason: 'Pas une agence',
      })
      response.assertStatus(500)
    } finally {
      app.container.restore(OrganizationService)
    }

    await organization.refresh()
    assert.isNull(organization.archivedAt)
    assert.deepEqual(organization.reviewReasons, ['vat_unverified', 'no_website'])
    assert.lengthOf(await AgencyReviewDecisionRecord.all(), 0)
    assert.lengthOf(await AdminAuditLog.all(), 0)
    fakeMailer.mails.assertNoneSent()
  })

  test('une décision inconnue ou une organisation inconnue est refusée', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await agency()

    const unknown = await decide(client, admin, organization.id, { decision: 'maybe' })
    unknown.assertStatus(422)
    const missing = await decide(client, admin, 999_999, { decision: 'approved' })
    missing.assertStatus(404)
  })
})

test.group('Revue des agences — tableau de bord', (group) => {
  useDatabase(group, { seed: 'full' })
  fakeMails(group)

  test('le compteur reprend les agences à revoir et baisse après une décision', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const before = await client.get('/fr/admin').withInertia().loginAs(admin)
    const base = before.inertiaProps.stats.pendingAgencyReviews as number
    const { organization } = await agency()

    const added = await client.get('/fr/admin').withInertia().loginAs(admin)
    assert.equal(added.inertiaProps.stats.pendingAgencyReviews, base + 1)

    await decide(client, admin, organization.id, { decision: 'approved' })
    const after = await client.get('/fr/admin').withInertia().loginAs(admin)
    assert.equal(after.inertiaProps.stats.pendingAgencyReviews, base)
  })
})
