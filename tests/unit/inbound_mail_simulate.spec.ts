import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import { urlFor } from '@adonisjs/core/services/url_builder'
import InboundMailSimulate from '../../commands/inbound_mail_simulate.js'
import { useDatabase } from '#tests/utils/setup'

/**
 * Hors serveur HTTP (suite `unit`, comme une command ace), les routes ne sont
 * figées que si quelqu'un appelle `router.commit()`. Sans cela, la
 * transmission à l'agence (#225), déclenchée dans le processus de la
 * commande, échouait sur `urlFor` et le mail n'était jamais envoyé.
 */
test.group('inbound-mail:simulate', (group) => {
  useDatabase(group, { seed: 'none' })

  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('fige les routes pour que les liens des mails se construisent', async ({ assert }) => {
    const command = await ace.create(InboundMailSimulate, ['rfq-inconnu@reply.test'])
    await command.exec()

    assert.equal(urlFor('rfqs.show', { locale: 'fr', id: 6 }), '/fr/rfqs/6')
  })
})
