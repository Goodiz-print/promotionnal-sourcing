import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { createIndexConcurrently } from '#database/concurrent_index'

const TABLE = 'rfq_suppliers'
const COLUMN = 'agency_reply_token'
const UNIQUE = 'rfq_suppliers_agency_reply_token_unique'
const NOT_NULL_CHECK = 'rfq_suppliers_agency_reply_token_present_check'

/**
 * Jeton de l'adresse relais **côté agence** d'un couple demande / fournisseur
 * (#225) : `agency-<jeton>@<domaine relais>`, posée en `Reply-To` du mail qui
 * transmet la réponse du fournisseur à l'agence.
 *
 * Distinct de `reply_token` : l'adresse côté fournisseur n'authentifie que par
 * son jeton, que l'agence ne doit donc jamais lire — elle pourrait sinon écrire
 * au nom du fournisseur dans le fil. Même génération par la base que
 * `reply_token` (UUID v4 sans tirets), chaque ligne avec sa valeur.
 *
 * Sans verrou long sur `rfq_suppliers` : hors transaction, une étape courte à
 * la fois. Un défaut volatil posé avec la colonne réécrirait la table sous
 * verrou exclusif ; on ajoute donc la colonne vide, puis le défaut (lignes
 * nouvelles), puis on remplit les lignes existantes. L'unicité vient d'un
 * index construit `CONCURRENTLY`, et le `NOT NULL` d'une contrainte `CHECK`
 * validée à part, que PostgreSQL réutilise au lieu de parcourir la table sous
 * verrou. Après un échec : `down`, puis relancer.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  async up() {
    this.defer(async (db) => {
      await addTokenColumn(db)
      await createIndexConcurrently(db, {
        name: UNIQUE,
        table: TABLE,
        columns: COLUMN,
        unique: true,
      })
      await db.rawQuery(
        `ALTER TABLE ${TABLE} ADD CONSTRAINT ${UNIQUE} UNIQUE USING INDEX ${UNIQUE}`
      )
      await requireToken(db)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${NOT_NULL_CHECK}`)
      await db.rawQuery(`ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ${UNIQUE}`)
      await db.rawQuery(`DROP INDEX IF EXISTS ${UNIQUE}`)
      await db.rawQuery(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS ${COLUMN}`)
    })
  }
}

/** Colonne vide, défaut pour les lignes nouvelles, puis remplissage des autres. */
async function addTokenColumn(db: QueryClientContract): Promise<void> {
  await db.rawQuery(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${COLUMN} varchar(32)`)
  await db.rawQuery(
    `ALTER TABLE ${TABLE} ALTER COLUMN ${COLUMN} SET DEFAULT replace(gen_random_uuid()::text, '-', '')`
  )
  await db.rawQuery(`UPDATE ${TABLE} SET ${COLUMN} = DEFAULT WHERE ${COLUMN} IS NULL`)
}

/**
 * `NOT NULL` sans parcours sous verrou exclusif : la contrainte `CHECK` est
 * validée sous un verrou qui laisse passer les écritures, puis sert de preuve
 * à `SET NOT NULL`, et n'est plus utile ensuite.
 */
async function requireToken(db: QueryClientContract): Promise<void> {
  await db.rawQuery(
    `ALTER TABLE ${TABLE} ADD CONSTRAINT ${NOT_NULL_CHECK} CHECK (${COLUMN} IS NOT NULL) NOT VALID`
  )
  await db.rawQuery(`ALTER TABLE ${TABLE} VALIDATE CONSTRAINT ${NOT_NULL_CHECK}`)
  await db.rawQuery(`ALTER TABLE ${TABLE} ALTER COLUMN ${COLUMN} SET NOT NULL`)
  await db.rawQuery(`ALTER TABLE ${TABLE} DROP CONSTRAINT ${NOT_NULL_CHECK}`)
}
