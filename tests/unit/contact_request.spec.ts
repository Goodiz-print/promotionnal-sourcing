import { test } from '@japa/runner'
import ContactRequestNotification from '#mails/contact_request_notification'
import { contactRequestValidator } from '#validators/contact'
import type { ContactRequestMailData } from '#shared/types/mail'

const VALID = {
  type: 'contact',
  name: ' Camille Durand ',
  company: 'Agence Bleue',
  email: 'Camille@Agence-Bleue.FR',
  message: 'Nous cherchons 500 tote bags.',
}

test.group('Formulaire de contact — validation', () => {
  test('normalise les champs et rend le téléphone facultatif', async ({ assert }) => {
    const input = await contactRequestValidator.validate(VALID)

    assert.equal(input.name, 'Camille Durand')
    assert.equal(input.email, 'camille@agence-bleue.fr')
    assert.isUndefined(input.phone)
  })

  test('refuse un type inconnu, un e-mail invalide et un message vide', async ({ assert }) => {
    for (const bad of [
      { ...VALID, type: 'autre' },
      { ...VALID, email: 'pas-un-email' },
      { ...VALID, message: '   ' },
      { ...VALID, company: '' },
    ]) {
      await assert.rejects(() => contactRequestValidator.validate(bad))
    }
  })

  test('borne la longueur du message', async ({ assert }) => {
    await assert.rejects(() =>
      contactRequestValidator.validate({ ...VALID, message: 'x'.repeat(5001) })
    )
  })
})

test.group('Formulaire de contact — mail', () => {
  const data: ContactRequestMailData = {
    type: 'partnership',
    name: 'Léa Martin',
    company: 'Textiles SA',
    email: 'lea@textiles.example',
    phone: null,
    message: '<script>alert(1)</script>\nBonjour',
    requesterLocale: 'de',
  }

  test("rend l'objet, le destinataire, le reply-to et échappe le message", async ({ assert }) => {
    const mailer = new ContactRequestNotification('partners@promotional-sourcing.eu', data)
    await mailer.buildWithContents()
    const { message } = mailer.message.toJSON() as { message: Record<string, any> }

    assert.equal(message.subject, '[Site] Demande de partenariat — Textiles SA')
    assert.isTrue(mailer.message.hasTo('partners@promotional-sourcing.eu'))
    assert.isTrue(mailer.message.hasReplyTo('lea@textiles.example', 'Léa Martin'))
    assert.include(message.html, 'Partenariat')
    assert.include(message.html, '&lt;script&gt;')
    assert.notInclude(message.html, '<script>')
    assert.include(message.html, '—')
  })
})
