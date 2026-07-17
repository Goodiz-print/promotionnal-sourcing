import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import queue from '@adonisjs/queue/services/main'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import GenerateProductEmbeddingJob from '#jobs/generate_product_embedding_job'

test.group('catalogue:backfill-embeddings', (group) => {
  if (isPostgres()) {
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'pgvector : PostgreSQL requis'))
  }

  test('met en file un job par produit sans embedding (aucun appel réseau)', async ({ assert }) => {
    using fake = queue.fake()

    const command = await ace.exec('catalogue:backfill-embeddings', [])

    assert.equal(command.exitCode, 0)
    fake.assertPushedCount(6)
    assert.equal(fake.getPushedJobs()[0].job.name, GenerateProductEmbeddingJob.name)
  })
})
