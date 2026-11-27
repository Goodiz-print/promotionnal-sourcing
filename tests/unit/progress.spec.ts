import { test } from '@japa/runner'
import { progressPercent } from '#shared/helpers/progress'

test.group('progressPercent', () => {
  test('total inconnu : null', ({ assert }) => {
    assert.isNull(progressPercent(3, null))
  })

  test('total nul : terminé', ({ assert }) => {
    assert.equal(progressPercent(0, 0), 100)
  })

  test('pourcentage arrondi', ({ assert }) => {
    assert.equal(progressPercent(1, 3), 33)
    assert.equal(progressPercent(2, 3), 67)
  })

  test('plafonné à 100', ({ assert }) => {
    assert.equal(progressPercent(12, 10), 100)
  })
})
