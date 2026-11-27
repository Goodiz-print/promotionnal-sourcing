import { test } from '@japa/runner'
import aiConfig from '#config/ai'
import { ImageDescriptionFailedError } from '#exceptions/image_search_errors'
import ClaudeImageDescriptionProvider from '#services/vision/claude_image_description_provider'
import { imageQuerySchema } from '#shared/helpers/llm'
import { fakeClaudeClient, type FakeClaudeReply } from '#tests/utils/fake_claude_client'

const IMAGE = Buffer.from('fake-jpeg')

const describeWith = (reply: FakeClaudeReply | Error, mimeType = 'image/jpeg') =>
  new ClaudeImageDescriptionProvider(fakeClaudeClient(reply).client).describe(IMAGE, mimeType, 'fr')

test.group('ClaudeImageDescriptionProvider', () => {
  test('envoie l’image en base64 et rend la requête du modèle', async ({ assert }) => {
    const { client, requests } = fakeClaudeClient({
      text: JSON.stringify({ query: 'gourde inox isotherme' }),
      leadingBlocks: [{ type: 'thinking' }],
    })

    const result = await new ClaudeImageDescriptionProvider(client).describe(
      IMAGE,
      'image/jpeg',
      'fr'
    )

    assert.deepEqual(result, { query: 'gourde inox isotherme' })
    const [request] = requests
    assert.equal(request.model, aiConfig.vision.model)
    assert.equal(request.max_tokens, aiConfig.vision.maxTokens)
    assert.include(request.system as string, 'code "fr"')
    assert.deepEqual(request.messages, [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: IMAGE.toString('base64') },
          },
        ],
      },
    ])
    assert.deepEqual(request.output_config, {
      effort: 'low',
      format: { type: 'json_schema', schema: imageQuerySchema() },
    })
  })

  test('une réponse qui n’est pas du JSON est rejetée', async ({ assert }) => {
    await assert.rejects(() => describeWith({ text: 'une gourde' }), /invalid JSON/)
  })

  test('une requête absente ou vide est rejetée', async ({ assert }) => {
    await assert.rejects(() => describeWith({ text: '{}' }), /missing query/)
    await assert.rejects(() => describeWith({ text: '{"query":"  "}' }), /missing query/)
    await assert.rejects(() => describeWith({ text: 'null' }), /missing query/)
    await assert.rejects(() => describeWith({}), /empty response/)
  })

  test('un refus du modèle est un échec de description', async ({ assert }) => {
    await assert.rejects(() => describeWith({ stopReason: 'refusal' }), ImageDescriptionFailedError)
  })

  test('un format d’image non accepté est rejeté sans appeler l’API', async ({ assert }) => {
    const { client, requests } = fakeClaudeClient({ text: '{"query":"x"}' })
    await assert.rejects(
      () => new ClaudeImageDescriptionProvider(client).describe(IMAGE, 'image/tiff', 'fr'),
      /unsupported image type "image\/tiff"/
    )
    assert.lengthOf(requests, 0)
  })

  test('une erreur de l’API est rapportée comme un échec de description', async ({ assert }) => {
    const attempt = () => describeWith(new Error('503 Service Unavailable'))
    await assert.rejects(attempt, ImageDescriptionFailedError)
    await assert.rejects(attempt, /503 Service/)
  })
})
