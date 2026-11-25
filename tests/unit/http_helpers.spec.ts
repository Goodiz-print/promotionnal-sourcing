import { test } from '@japa/runner'
import { absoluteUrl, attachmentDisposition } from '#shared/helpers/http'

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

test.group('HTTP — URL absolue d’un lien envoyé par mail', () => {
  test('préfixe un chemin par le domaine, querystring conservée', ({ assert }) => {
    assert.equal(
      absoluteUrl('/fr/email/verify/12?v=ab&signature=xy', 'https://app.example.com'),
      'https://app.example.com/fr/email/verify/12?v=ab&signature=xy'
    )
  })

  test('ignore le chemin et la barre finale de l’URL de base', ({ assert }) => {
    assert.equal(
      absoluteUrl('/fr/login', 'https://app.example.com/ignored/'),
      'https://app.example.com/fr/login'
    )
  })

  test('rend tel quel un lien déjà absolu', ({ assert }) => {
    assert.equal(
      absoluteUrl('https://autre.example.com/x', 'https://app.example.com'),
      'https://autre.example.com/x'
    )
  })
})
