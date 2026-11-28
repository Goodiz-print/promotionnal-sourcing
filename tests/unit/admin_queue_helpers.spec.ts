import { test } from '@japa/runner'
import { queueJobDisplayedTime } from '#shared/helpers/admin_queue'

const times = { finishedAt: 'fin', acquiredAt: 'prise', dueAt: 'échéance' }

test.group('queueJobDisplayedTime', () => {
  test('job terminé ou échoué : date de fin', ({ assert }) => {
    assert.equal(queueJobDisplayedTime('completed', times), 'fin')
    assert.equal(queueJobDisplayedTime('failed', times), 'fin')
  })

  test('job actif : date de prise en charge', ({ assert }) => {
    assert.equal(queueJobDisplayedTime('active', times), 'prise')
  })

  test('job en attente ou différé : échéance', ({ assert }) => {
    assert.equal(queueJobDisplayedTime('pending', times), 'échéance')
    assert.equal(queueJobDisplayedTime('delayed', times), 'échéance')
  })

  test('renvoie null si l’horodatage manque', ({ assert }) => {
    assert.isNull(queueJobDisplayedTime('active', { ...times, acquiredAt: null }))
  })
})
