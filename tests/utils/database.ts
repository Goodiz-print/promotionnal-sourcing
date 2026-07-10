import db from '@adonisjs/lucid/services/db'

/**
 * Le catalogue s'appuie sur des fonctionnalités PostgreSQL (pgvector,
 * tsvector, colonnes générées) absentes de SQLite. Les groupes de tests qui
 * touchent le catalogue sont donc gardés par ce prédicat : exécutés sous
 * Postgres (CI + `DB_CONNECTION=pg` en local), sautés sinon.
 */
export function isPostgres(): boolean {
  return db.connection().dialect.name === 'postgres'
}
