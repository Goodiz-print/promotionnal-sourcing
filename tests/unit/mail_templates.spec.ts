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
import QuoteEmailVerificationNotification from '#mails/quote_email_verification_notification'
import RfqReceivedNotification from '#mails/rfq_received_notification'
import RfqReminderNotification from '#mails/rfq_reminder_notification'
import SubscriptionActivatedNotification from '#mails/subscription_activated_notification'
import SubscriptionExpiringNotification from '#mails/subscription_expiring_notification'
import WelcomeNotification from '#mails/welcome_notification'
import { SUPPORTED_LOCALES, type Locale } from '#shared/types/i18n'
import { NOTIFICATION_EMAIL_FALLBACK } from '#shared/types/notification'
import type User from '#models/user'
import type { RfqMailLine, RfqReceivedMailData } from '#shared/types/mail'

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
  return {
    subject: message.subject as string,
    html: message.html as string,
    text: (message.text ?? '') as string,
  }
}

/** Demande à plusieurs lignes : avec et sans marquage, avec et sans prix indicatif (#219). */
const RFQ_LINES: RfqMailLine[] = [
  {
    name: 'Tote bag coton',
    reference: 'TB-01-NAT',
    variant: 'Naturel',
    quantity: 500,
    unit: 'pcs',
    marking: { position: 'Face avant', technique: 'Sérigraphie', colors: '2' },
    note: 'Logo centré',
    prices: {
      unitPrice: '1.20 EUR',
      markingUnitPrice: '0.45 EUR',
      setupCharge: '60.00 EUR',
      total: '885.00 EUR',
    },
  },
  {
    name: 'Mug céramique',
    reference: null,
    variant: null,
    quantity: 200,
    unit: null,
    marking: null,
    note: null,
    prices: null,
  },
]

const RFQ_DATA: RfqReceivedMailData = {
  buyerName: 'Acme',
  rfqTitle: 'Tote bags',
  itemCount: RFQ_LINES.length,
  deadline: '30/10/2026',
  rfqPath: '/x/supplier/rfqs/1',
  description: 'Salon de mars, livraison à Lyon',
  lines: RFQ_LINES,
  replyTo: 'rfq-abc@relay.test',
}

/** Même demande, vue par un fournisseur non abonné (#220, #222). */
const ANONYMOUS_RFQ_DATA: RfqReceivedMailData = {
  ...RFQ_DATA,
  buyerName: null,
  subscribePath: '/x/supplier/subscription',
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
      { ...RFQ_DATA, itemCount: 3, lines: [] },
      locale
    ) as never,
  rfqReminder: (locale) =>
    new RfqReminderNotification(
      'supplier@example.com',
      {
        buyerName: 'Acme',
        rfqTitle: 'Tote bags',
        deadline: '30/10/2026',
        rfqPath: '/x/supplier/rfqs/1',
      },
      locale
    ) as never,
  rfqReceivedAnonymous: (locale) =>
    new RfqReceivedNotification('supplier@example.com', ANONYMOUS_RFQ_DATA, locale) as never,
  rfqReminderAnonymous: (locale) =>
    new RfqReminderNotification('supplier@example.com', ANONYMOUS_RFQ_DATA, locale) as never,
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
  subscriptionActivated: (locale) =>
    new SubscriptionActivatedNotification(
      'owner@example.com',
      {
        organizationName: 'Acme',
        plan: 'premium',
        startsOn: '20/11/2026',
        endsOn: '19/11/2027',
        path: '/x/supplier/subscription',
      },
      locale
    ) as never,
  subscriptionExpiring: (locale) =>
    new SubscriptionExpiringNotification(
      'owner@example.com',
      {
        organizationName: 'Acme',
        plan: 'business',
        endsOn: '19/11/2027',
        daysLeft: 7,
        path: '/x/supplier/subscription',
      },
      locale
    ) as never,
  quoteEmailVerification: (locale) =>
    new QuoteEmailVerificationNotification(
      'devis@example.com',
      {
        organizationName: 'Textiles SA',
        verifyUrl: 'https://example.test/verify',
        expiresInHours: 168,
      },
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

  test('un libellé non formatable n’empêche pas le rappel de partir, lien compris', async ({
    assert,
  }) => {
    const mailer = new NotificationReminderNotification(
      'admin@example.com',
      'subscription.duplicate_cancelled',
      {},
      '/x/admin/organizations/7',
      'fr'
    )
    const { subject, html } = await render(mailer as never)

    assert.isNotEmpty(subject)
    assert.include(html, '/x/admin/organizations/7')
    assert.notInclude(html, 'notifications.types')
    assert.notInclude(html, '{organizationName}')
  })

  test('chaque type à rappeler a son libellé dans les 9 langues', async ({ assert }) => {
    for (const type of Object.keys(NOTIFICATION_EMAIL_FALLBACK)) {
      const [group, name] = type.split('.')
      for (const locale of SUPPORTED_LOCALES) {
        const labels = JSON.parse(
          readFileSync(app.languageFilesPath(`${locale}/notifications.json`), 'utf8')
        )
        const label = name ? labels.types?.[group]?.[name] : labels.types?.[group]
        assert.isString(label, `${locale} : notifications.types.${type}`)
      }
    }
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
      {
        buyerName: '<script>alert(1)</script>',
        rfqTitle: 'Tote',
        itemCount: 1,
        deadline: null,
        rfqPath: '/x',
      },
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

test.group('Mails — confirmation de l’adresse de réception (#217)', () => {
  test('le lien, la durée en jours et le nom du fournisseur figurent dans le mail', async ({
    assert,
  }) => {
    const { subject, html } = await render(
      new QuoteEmailVerificationNotification(
        'devis@example.com',
        {
          organizationName: 'Textiles SA',
          verifyUrl: 'https://example.test/v',
          expiresInHours: 168,
        },
        'fr'
      ) as never
    )

    assert.include(subject, 'Textiles SA')
    assert.include(html, 'https://example.test/v')
    assert.include(html, '7 jours')
  })
})

test.group('Mails — demande de devis complète (#219)', () => {
  test('chaque ligne porte produit, référence, variante, quantité, marquage et note', async ({
    assert,
  }) => {
    const { html } = await render(new RfqReceivedNotification('s@x.test', RFQ_DATA, 'fr') as never)

    assert.include(html, 'Salon de mars, livraison à Lyon')
    assert.include(html, '2 lignes à chiffrer')
    ;['Tote bag coton', 'TB-01-NAT', 'Naturel', '500 pcs', 'Logo centré'].forEach((value) =>
      assert.include(html, value)
    )
    assert.include(html, 'Face avant · Sérigraphie · 2 couleurs')
    assert.include(html, 'Mug céramique')
    assert.include(html, 'Sans marquage')
  })

  test('le prix indicatif figure par ligne, et une ligne sans prix l’indique', async ({
    assert,
  }) => {
    const { html } = await render(new RfqReceivedNotification('s@x.test', RFQ_DATA, 'fr') as never)

    ;['1.20 EUR', '0.45 EUR', '60.00 EUR', '885.00 EUR'].forEach((price) =>
      assert.include(html, price)
    )
    assert.include(html, 'Prix unitaire indicatif')
    assert.include(html, 'Pas de prix catalogue : à chiffrer')
    assert.include(html, 'Ce ne sont pas des prix convenus')
  })

  test('la version texte reprend les lignes, sans échappement HTML', async ({ assert }) => {
    const data = { ...RFQ_DATA, description: 'Logos « A & B »' }
    const { text } = await render(new RfqReceivedNotification('s@x.test', data, 'fr') as never)

    assert.include(text, 'Logos « A & B »')
    assert.include(text, '1. Tote bag coton')
    assert.include(text, 'Référence : TB-01-NAT')
    assert.include(text, 'Total indicatif : 885.00 EUR')
    assert.include(text, '2. Mug céramique')
    assert.include(text, 'Prix indicatif : Pas de prix catalogue : à chiffrer')
    assert.include(text, '/x/supplier/rfqs/1')
    assert.notInclude(text, '<')
    assert.notInclude(text, '&amp;')
  })

  test('avec une adresse relais, le mail invite à répondre au lieu de l’interdire', async ({
    assert,
  }) => {
    const relayed = await render(new RfqReceivedNotification('s@x.test', RFQ_DATA, 'fr') as never)
    const plain = await render(
      new RfqReceivedNotification('s@x.test', { ...RFQ_DATA, replyTo: null }, 'fr') as never
    )

    assert.include(relayed.html, 'répondez simplement à ce mail')
    assert.notInclude(relayed.html, 'merci de ne pas y répondre')
    assert.notInclude(plain.html, 'répondez simplement à ce mail')
    assert.include(plain.html, 'merci de ne pas y répondre')
  })

  test('la relance reprend les mêmes lignes', async ({ assert }) => {
    const { html, text } = await render(
      new RfqReminderNotification('s@x.test', RFQ_DATA, 'en') as never
    )

    assert.include(html, 'Tote bag coton')
    assert.include(html, 'No catalogue price: to be quoted')
    assert.include(text, '2 lines to quote')
  })

  test('un job mis en queue avant #219, sans lignes, se rend toujours', async ({ assert }) => {
    const legacy: RfqReceivedMailData = {
      buyerName: 'Acme',
      rfqTitle: 'Tote bags',
      itemCount: 2,
      deadline: null,
      rfqPath: '/x/supplier/rfqs/1',
    }
    const { html, text } = await render(
      new RfqReceivedNotification('s@x.test', legacy, 'fr') as never
    )

    assert.include(html, 'Tote bags')
    assert.notInclude(html, 'Prix unitaire indicatif')
    assert.include(text, '/x/supplier/rfqs/1')
  })
})

test.group('Mails — demande anonyme pour un fournisseur non abonné (#220, #222)', () => {
  test('ni l’objet ni le corps ne nomment l’agence, l’encart mène à l’abonnement', async ({
    assert,
  }) => {
    const { subject, html, text } = await render(
      new RfqReceivedNotification('s@x.test', ANONYMOUS_RFQ_DATA, 'fr') as never
    )

    assert.equal(subject, 'Nouvelle demande de devis')
    assert.notInclude(html, 'Acme')
    assert.notInclude(text, 'Acme')
    assert.include(html, 'Une agence vous invite à chiffrer la demande')
    assert.include(html, '/x/supplier/subscription')
    assert.include(text, 'Découvrir les abonnements')
    assert.include(text, '/x/supplier/subscription')
  })

  test('la relance anonyme ne nomme pas l’agence et porte l’encart', async ({ assert }) => {
    const { html, text } = await render(
      new RfqReminderNotification('s@x.test', ANONYMOUS_RFQ_DATA, 'en') as never
    )

    assert.notInclude(html, 'Acme')
    assert.notInclude(text, 'Acme')
    assert.include(html, 'An agency sent you the request')
    assert.include(html, '/x/supplier/subscription')
  })

  test('un abonné voit l’agence, sans encart d’abonnement', async ({ assert }) => {
    const { subject, html } = await render(
      new RfqReceivedNotification('s@x.test', { ...RFQ_DATA, subscribePath: null }, 'fr') as never
    )

    assert.include(subject, 'Acme')
    assert.include(html, 'Acme vous invite')
    assert.notInclude(html, 'Découvrir les abonnements')
  })
})
