import { test } from '@japa/runner'
import { hasPdfHeader } from '#shared/helpers/pdf'

test.group('hasPdfHeader', () => {
  test('reconnaît un contenu qui commence par `%PDF-`', ({ assert }) => {
    assert.isTrue(hasPdfHeader(Buffer.from('%PDF-1.7\n…')))
  })

  test('refuse un contenu sans en-tête PDF, même court ou vide', ({ assert }) => {
    assert.isFalse(hasPdfHeader(Buffer.from('<html>pas un pdf</html>')))
    assert.isFalse(hasPdfHeader(Buffer.from('%PDF')))
    assert.isFalse(hasPdfHeader(Buffer.alloc(0)))
  })

  test('l’en-tête doit être au tout début du fichier', ({ assert }) => {
    assert.isFalse(hasPdfHeader(Buffer.from(' %PDF-1.4')))
  })
})
