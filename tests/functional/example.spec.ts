import { test } from '@japa/runner'

test.group('Example functional tests', () => {
  test('home page returns 200', async ({ client }) => {
    const response = await client.get('/')
    response.assertStatus(200)
  })
})
