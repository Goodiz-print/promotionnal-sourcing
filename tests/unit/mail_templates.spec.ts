import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import AgencyReviewDecisionNotification from '#mails/agency_review_decision_notification'
import AnnouncementNotification from '#mails/announcement_notification'
import EmailVerificationNotification from '#mails/email_verification_notification'
import NotificationReminderNotification from '#mails/notification_reminder_notification'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import PasswordResetNotification from '#mails/password_reset_notification'
import QuoteReceivedNotification from '#mails/quote_received_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import WelcomeNotification from '#mails/welcome_notification'
import { SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'
import type User from '#models/user'

/**
 * Rendu des mails dans la langue du destinataire (#58). Aucune base : on
 * construit la classe de mail et on rend son sujet et son HTML.
 */
async function render(mailer: {
  buildWithContents(): Promise<void>
  message: { toJSON(): { message: Record<string, any> } }
}) {
  await mailer.buildWithContents()
  const { message } = mailer.message.toJSON()
  return { subject: message.subject as string, html: message.html as string }
}

const mailers: Record<string, (locale: Locale) => Parameters<typeof render>[0]> = {
  invitation: (locale) =>
    new OrganizationInvitationNotification(
      'invited@example.com',
      'Acme',
      'Manager',
      'Alice',
      'https://example.test/accept',
      locale
    ) as never,
  rfqReceived: (locale) =>
    new RfqReceivedNotification(
      'supplier@example.com',
      'Acme',
      'Tote bags',
      3,
      '30/10/2026',
      '/x/supplier/rfqs/1',
      locale
    ) as never,
  rfqReminder: (locale) =>
    new RfqReminderNotification(
      'supplier@example.com',
      'Acme',
      'Tote bags',
      '30/10/2026',
      '/x/supplier/rfqs/1',
      locale
    ) as never,
  quoteReceived: (locale) =>
    new QuoteReceivedNotification(
      'buyer@example.com',
      'Textiles SA',
      'Tote bags',
      '1 000,00 €',
      '/x/quotes/1',
      locale
    ) as never,
  passwordReset: (locale) =>
    new PasswordResetNotification(
      'member@example.com',
      'https://example.test/reset',
      60,
      locale
    ) as never,
  emailVerification: (locale) =>
    new EmailVerificationNotification(
      'new@example.com',
      'https://example.test/verify',
      24,
      locale
    ) as never,
  agencyReviewApproved: (locale) =>
    new AgencyReviewDecisionNotification(
      'owner@example.com',
      'Acme',
      'approved',
      null,
      locale
    ) as never,
  agencyReviewRejected: (locale) =>
    new AgencyReviewDecisionNotification(
      'owner@example.com',
      'Acme',
      'rejected',
      'Pas une agence',
      locale
    ) as never,
  agencyReviewInfoRequested: (locale) =>
    new AgencyReviewDecisionNotification(
      'owner@example.com',
      'Acme',
      'info_requested',
      'Merci de joindre un Kbis.',
      locale
    ) as never,
  notificationReminder: (locale) =>
    new NotificationReminderNotification(
      'admin@example.com',
      'subscription.duplicate_cancelled',
      { organizationName: 'Acme', organizationId: 7, cancelledSubscriptionId: 'sub_123' },
      '/x/admin/organizations/7',
      locale
    ) as never,
  welcome: (locale) =>
    new WelcomeNotification({
      email: 'new@example.com',
      fullName: 'Nina',
      locale,
    } as unknown as User) as never,
}

test.group('Mails — rendu dans la langue du destinataire', () => {
  for (const [name, build] of Object.entries(mailers)) {
    test(`${name} : sujet et corps rendus dans chaque langue, sans clé brute`, async ({
      assert,
    }) => {
      const subjects = new Set<string>()

      for (const locale of SUPPORTED_LOCALES) {
        const { subject, html } = await render(build(locale))

        assert.isNotEmpty(subject, locale)
        assert.notInclude(subject, 'emails.', locale)
        assert.notInclude(html, 'emails.', locale)
        assert.notInclude(subject, '{', locale)
        assert.include(html, `<html lang="${locale}">`)
        subjects.add(subject)
      }

      // Chaque langue a son propre sujet.
      assert.equal(subjects.size, SUPPORTED_LOCALES.length)
    })
  }

  test('le même envoi donne un sujet français ou anglais selon le destinataire', async ({
    assert,
  }) => {
    const fr = await render(mailers.rfqReceived('fr'))
    const en = await render(mailers.rfqReceived('en'))

    assert.equal(fr.subject, 'Nouvelle demande de devis de Acme')
    assert.equal(en.subject, 'New request for quotation from Acme')
    assert.include(fr.html, 'Consulter la demande')
    assert.include(en.html, 'View the request')
    assert.include(en.html, '3 lines')
  })

  test('la décision sur une agence affiche le motif saisi, échappé', async ({ assert }) => {
    const rejected = await render(mailers.agencyReviewRejected('fr'))
    assert.include(rejected.html, 'Pas une agence')
    assert.include(rejected.html, 'Message de l&#x27;équipe')

    const approved = await render(mailers.agencyReviewApproved('fr'))
    assert.notInclude(approved.html, 'Message de l')

    const mailer = new AgencyReviewDecisionNotification(
      'owner@example.com',
      'Acme',
      'info_requested',
      '<script>alert(1)</script>',
      'en'
    )
    const { html } = await render(mailer as never)
    assert.notInclude(html, '<script>alert(1)</script>')
  })

  test('le rappel de notification reprend le texte de la notification et son lien', async ({
    assert,
  }) => {
    const { html } = await render(mailers.notificationReminder('de'))

    assert.include(html, 'Acme hat zwei Abonnements gleichzeitig bezahlt')
    assert.include(html, 'sub_123')
    assert.include(html, '/x/admin/organizations/7')
    assert.notInclude(html, 'notifications.types')
  })

  test('le pluriel suit les règles de la langue (polonais : one / few / many)', async ({
    assert,
  }) => {
    const { html } = await render(mailers.passwordReset('pl'))

    assert.include(html, '60 minut')
  })

  test('une valeur saisie par un utilisateur reste échappée', async ({ assert }) => {
    const mailer = new RfqReceivedNotification(
      'supplier@example.com',
      '<script>alert(1)</script>',
      'Tote',
      1,
      null,
      '/x',
      'en'
    )
    const { html } = await render(mailer as never)

    assert.notInclude(html, '<script>alert(1)</script>')
    assert.include(html, '&lt;script&gt;')
  })
})

test.group('Mails — fichiers de langue', () => {
  const load = (locale: string) =>
    JSON.parse(readFileSync(app.languageFilesPath(`${locale}/emails.json`), 'utf8'))

  const flatten = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, child]) =>
          flatten(child, prefix ? `${prefix}.${key}` : key)
        )
      : [prefix]

  test('emails.json existe pour chaque langue, avec les mêmes clés que le français', ({
    assert,
  }) => {
    const reference = flatten(load('fr')).sort()

    for (const locale of SUPPORTED_LOCALES) {
      assert.deepEqual(flatten(load(locale)).sort(), reference, locale)
    }
  })
})

test.group('Mails — annonce plateforme', () => {
  test('le titre est le sujet, le texte est échappé et le pied de page est traduit', async ({
    assert,
  }) => {
    const footers = new Set<string>()

    for (const locale of SUPPORTED_LOCALES) {
      const { subject, html } = await render(
        new AnnouncementNotification(
          'user@example.com',
          'Maintenance dimanche',
          'Ligne 1\n<script>alert(1)</script>',
          locale
        ) as never
      )

      assert.equal(subject, 'Maintenance dimanche', locale)
      assert.notInclude(html, 'emails.', locale)
      assert.notInclude(html, '<script>', locale)
      assert.include(html, '&lt;script&gt;', locale)
      assert.include(html, `<html lang="${locale}">`)
      footers.add(html.match(/<div class="footer">([\s\S]*?)<\/div>/)?.[1].trim() ?? '')
    }

    assert.equal(footers.size, SUPPORTED_LOCALES.length)
  })
})
