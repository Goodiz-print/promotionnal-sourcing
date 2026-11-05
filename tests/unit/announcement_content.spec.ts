import { test } from '@japa/runner'
import { pickAnnouncementContent } from '#shared/helpers/announcement'

const FR = { title: 'Titre', body: 'Texte' }
const EN = { title: 'Title', body: 'Text' }

test.group('Annonces — choix de la langue du contenu', () => {
  test('sert la langue du destinataire quand elle existe', ({ assert }) => {
    assert.deepEqual(pickAnnouncementContent({ fr: FR, en: EN }, 'fr'), FR)
    assert.deepEqual(pickAnnouncementContent({ fr: FR, en: EN }, 'en'), EN)
  })

  test('retombe sur l’anglais, puis sur le français', ({ assert }) => {
    assert.deepEqual(pickAnnouncementContent({ fr: FR, en: EN }, 'de'), EN)
    assert.deepEqual(pickAnnouncementContent({ fr: FR }, 'de'), FR)
    assert.deepEqual(pickAnnouncementContent({ fr: FR }, 'en'), FR)
  })

  test('ne casse pas sur un contenu vide', ({ assert }) => {
    assert.deepEqual(pickAnnouncementContent({}, 'fr'), { title: '', body: '' })
  })
})
