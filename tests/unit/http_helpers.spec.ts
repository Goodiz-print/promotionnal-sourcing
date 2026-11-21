import { test } from '@japa/runner'
import { attachmentDisposition } from '#shared/helpers/http'

test.group('HTTP — Content-Disposition d’un téléchargement', () => {
  test('un nom ASCII passe tel quel, en repli et en UTF-8', ({ assert }) => {
    assert.equal(
      attachmentDisposition('devis.pdf'),
      `attachment; filename="devis.pdf"; filename*=UTF-8''devis.pdf`
    )
  })

  test('un nom accentué garde un repli ASCII et son nom exact encodé', ({ assert }) => {
    assert.equal(
      attachmentDisposition('Devis été (v2).pdf'),
      `attachment; filename="Devis ete (v2).pdf"; filename*=UTF-8''Devis%20%C3%A9t%C3%A9%20%28v2%29.pdf`
    )
  })

  test('guillemets, chemins et retours à la ligne sont retirés', ({ assert }) => {
    const header = attachmentDisposition('../a"b\r\nX-Evil: 1.pdf')

    assert.notInclude(header, '\n')
    assert.notInclude(header, '/')
    assert.include(header, 'filename="..abX-Evil: 1.pdf"')
  })

  test('un nom vide retombe sur « document »', ({ assert }) => {
    assert.include(attachmentDisposition('"/"'), 'filename="document"')
  })
})
