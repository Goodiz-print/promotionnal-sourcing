import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import type { ApiClient } from '@japa/api-client'
import { OrganizationFactory } from '#database/factories/organization_factory'
import QuoteEmailVerificationNotification from '#mails/quote_email_verification_notification'
import SupplierProfile from '#models/supplier_profile'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'
import type { QuoteEmailVerificationMailData } from '#shared/types/mail'

interface SentVerification {
  email: string
  data: QuoteEmailVerificationMailData
}

async function supplierOwner() {
  const organization = await OrganizationFactory.apply('supplier').create()
  const owner = await createMember(organization, 'owner')
  return { organization, owner }
}

/** Enregistre le profil avec cette adresse de réception ; renvoie les liens partis. */
async function saveQuoteEmail(client: ApiClient, owner: User, quoteEmail: string | null) {
  const { mails } = mail.fake()
  try {
    const response = await client
      .patch('/fr/supplier/profile')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ quoteEmail })
    response.assertStatus(200)
    return mails.sent(
      (mailer) => mailer instanceof QuoteEmailVerificationNotification
    ) as unknown as SentVerification[]
  } finally {
    mail.restore()
  }
}

/** Chemin du lien reçu (l'URL signée peut être absolue). */
function linkOf(sent: SentVerification): string {
  const url = new URL(sent.data.verifyUrl, 'http://localhost')
  return `${url.pathname}${url.search}`
}

/** Confirmation de l'adresse de réception des demandes de devis par lien (#217). */
test.group('Adresse de réception — confirmation par lien', (group) => {
  useDatabase(group)

  test('une nouvelle adresse reçoit un lien et n’est confirmée qu’après le clic', async ({
    client,
    assert,
  }) => {
    const { organization, owner } = await supplierOwner()

    const sent = await saveQuoteEmail(client, owner, 'devis@fournisseur.test')

    assert.lengthOf(sent, 1)
    assert.equal(sent[0].email, 'devis@fournisseur.test')
    assert.equal(sent[0].data.organizationName, organization.name)
    const before = await SupplierProfile.findByOrFail('organizationId', organization.id)
    assert.isNull(before.quoteEmailVerifiedAt)

    // Ouvert sans session : la boîte de réception peut n'appartenir à aucun compte.
    const response = await client.get(linkOf(sent[0])).redirects(0)

    response.assertStatus(302)
    await before.refresh()
    assert.isNotNull(before.quoteEmailVerifiedAt)
  })

  test('changer d’adresse remet la confirmation à zéro et invalide l’ancien lien', async ({
    client,
    assert,
  }) => {
    const { organization, owner } = await supplierOwner()
    const [first] = await saveQuoteEmail(client, owner, 'devis@fournisseur.test')
    await client.get(linkOf(first)).redirects(0)

    const [second] = await saveQuoteEmail(client, owner, 'commandes@fournisseur.test')
    const profile = await SupplierProfile.findByOrFail('organizationId', organization.id)
    assert.isNull(profile.quoteEmailVerifiedAt)
    assert.equal(second.email, 'commandes@fournisseur.test')

    await client.get(linkOf(first)).redirects(0)
    await profile.refresh()
    assert.isNull(profile.quoteEmailVerifiedAt)
  })

  test('réenregistrer la même adresse (casse comprise) ne renvoie rien', async ({
    client,
    assert,
  }) => {
    const { organization, owner } = await supplierOwner()
    const [link] = await saveQuoteEmail(client, owner, 'devis@fournisseur.test')
    await client.get(linkOf(link)).redirects(0)

    const sent = await saveQuoteEmail(client, owner, 'Devis@Fournisseur.test')

    assert.lengthOf(sent, 0)
    const profile = await SupplierProfile.findByOrFail('organizationId', organization.id)
    assert.isNotNull(profile.quoteEmailVerifiedAt)
  })

  test('un lien falsifié ne confirme rien', async ({ client, assert }) => {
    const { organization, owner } = await supplierOwner()
    const [sent] = await saveQuoteEmail(client, owner, 'devis@fournisseur.test')
    const forged = linkOf(sent).replace(/v=[0-9a-f]+/, `v=${'0'.repeat(64)}`)

    await client.get(forged).redirects(0)

    const profile = await SupplierProfile.findByOrFail('organizationId', organization.id)
    assert.isNull(profile.quoteEmailVerifiedAt)
  })

  test('le lien peut être renvoyé tant que l’adresse n’est pas confirmée', async ({
    client,
    assert,
  }) => {
    const { owner } = await supplierOwner()
    await saveQuoteEmail(client, owner, 'devis@fournisseur.test')

    const { mails } = mail.fake()
    try {
      const response = await client
        .post('/fr/supplier/profile/quote-email/resend')
        .withInertia()
        .withCsrfToken()
        .loginAs(owner)
        .redirects(0)

      response.assertStatus(302)
      const sent = mails.sent((mailer) => mailer instanceof QuoteEmailVerificationNotification)
      assert.lengthOf(sent, 1)
    } finally {
      mail.restore()
    }
  })

  test('un membre sans droit sur le profil ne peut pas renvoyer le lien (403)', async ({
    client,
  }) => {
    const { organization } = await supplierOwner()
    const member = await createMember(organization, 'member')

    const response = await client
      .post('/fr/supplier/profile/quote-email/resend')
      .header('Accept', 'application/json')
      .withInertia()
      .withCsrfToken()
      .loginAs(member)

    response.assertStatus(403)
  })
})
