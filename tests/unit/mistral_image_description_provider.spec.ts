import { test } from '@japa/runner'
import MistralImageDescriptionProvider from '#services/vision/mistral_image_description_provider'
import type { MistralChatClientLike } from '#shared/types/ai'

type Request = Parameters<MistralChatClientLike['chat']['complete']>[0]

function clientReturning(content: unknown, requests: Request[] = []): MistralChatClientLike {
  return {
    chat: {
      async complete(request) {
        requests.push(request)
        return { choices: [{ message: { content } }] }
      },
    },
  }
}

const IMAGE = Buffer.from('fake-jpeg')

test.group('MistralImageDescriptionProvider', () => {
  test('envoie l’image en data URL et rend la requête du modèle', async ({ assert }) => {
    const requests: Request[] = []
    const provider = new MistralImageDescriptionProvider(
      clientReturning(JSON.stringify({ query: 'gourde inox isotherme' }), requests)
    )

    const result = await provider.describe(IMAGE, 'image/jpeg', 'fr')

    assert.deepEqual(result, { query: 'gourde inox isotherme' })
    const [request] = requests
    assert.include(request.messages[0].content as string, 'code "fr"')
    assert.deepEqual(request.messages[1].content, [
      { type: 'image_url', imageUrl: `data:image/jpeg;base64,${IMAGE.toString('base64')}` },
    ])
  })

  test('une réponse qui n’est pas du JSON est rejetée', async ({ assert }) => {
    const provider = new MistralImageDescriptionProvider(clientReturning('une gourde'))
    await assert.rejects(() => provider.describe(IMAGE, 'image/jpeg', 'fr'), /invalid JSON/)
  })

  test('une requête absente ou vide est rejetée', async ({ assert }) => {
    for (const content of [JSON.stringify({}), JSON.stringify({ query: '  ' }), undefined]) {
      const provider = new MistralImageDescriptionProvider(clientReturning(content))
      await assert.rejects(
        () => provider.describe(IMAGE, 'image/jpeg', 'fr'),
        /Image description failed/
      )
    }
  })

  test('une erreur de l’API est rapportée comme un échec de description', async ({ assert }) => {
    const client: MistralChatClientLike = {
      chat: {
        async complete() {
          throw new Error('503 Service Unavailable')
        },
      },
    }
    const provider = new MistralImageDescriptionProvider(client)
    await assert.rejects(() => provider.describe(IMAGE, 'image/jpeg', 'fr'), /503 Service/)
  })
})
