import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Group } from '@japa/runner/core'
import type { BaseSeeder } from '@adonisjs/lucid/seeders'
import MainSeeder from '#database/seeders/main_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import RoleSeeder from '#database/seeders/role_seeder'

type SeederClass = new (client: ReturnType<typeof db.connection>) => BaseSeeder

/**
 * Rôles, permissions et leur association : le strict nécessaire pour créer un
 * membre. `full` y ajoute le catalogue via `MainSeeder`.
 */
const ROLE_SEEDERS: SeederClass[] = [RoleSeeder, PermissionSeeder, RolePermissionSeeder]

export interface UseDatabaseOptions {
  /**
   * `roles` (défaut) — rôles et permissions seuls ;
   * `full` — `MainSeeder`, qui sème aussi le catalogue et l'utilisateur de démo ;
   * `none` — vidage seul, pour les specs qui créent tout ce dont elles ont besoin.
   *
   * On passe par `MainSeeder` plutôt que `db:seed` : ce dernier exécuterait
   * chaque seeder isolément, donc `dev_user` avant les rôles.
   */
  seed?: 'none' | 'roles' | 'full'

  /**
   * Seeders supplémentaires joués après les précédents (taxonomie, fixtures
   * spécifiques à un écran…).
   */
  extraSeeders?: SeederClass[]

  /**
   * `true` (défaut) — chaque test s'exécute dans une transaction globale annulée
   * à sa fin : un test peut muter librement les données semées, le suivant
   * repart de l'état semé sans re-vidage ni re-semis.
   * `false` — pas de transaction, pour les groupes en lecture seule (rien ne
   * doit y écrire : rien ne les protège).
   */
  perTest?: boolean
}

/**
 * Branche le cycle de vie base de données d'un groupe de tests.
 *
 * - **Une fois par groupe** : `truncate()` (qui lance au passage `migration:run`,
 *   idempotent) puis les seeders. Le `truncate` de fin de groupe est le cleanup
 *   renvoyé par ce hook : le groupe suivant repart d'une base vide.
 * - **Avant chaque test** (`perTest`, défaut) : une transaction globale, annulée
 *   à la fin du test. Les `db.transaction()` du code testé deviennent des
 *   savepoints. Les séquences d'identifiants ne sont pas remises à zéro par le
 *   rollback : un test ne doit pas dépendre d'un `id` en dur.
 *
 * Remplace les hooks recopiés dans chaque spec — et garantit que tout le monde
 * sème la même chose, dans le même ordre.
 */
export function useDatabase(group: Group, options: UseDatabaseOptions = {}): void {
  const { seed = 'roles', extraSeeders = [], perTest = true } = options
  const base = { none: [], roles: ROLE_SEEDERS, full: [MainSeeder] }[seed]
  const seeders = [...base, ...extraSeeders]
  const hooks = perTest ? group.each : group

  group.setup(async () => {
    const cleanup = await testUtils.db().truncate()
    for (const Seeder of seeders) {
      await new Seeder(db.connection()).run()
    }
    return cleanup
  })

  // Compteurs de rate limiting (store mémoire en test) : toutes les requêtes de
  // test partagent la même IP, ils s'accumuleraient d'une spec à l'autre — et,
  // en mémoire, le rollback de la transaction ne les remet pas à zéro.
  hooks.setup(() => limiter.clear())

  if (perTest) {
    group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  }
}

/**
 * Sème rôles et permissions hors du cycle `useDatabase`, pour les groupes qui
 * gèrent eux-mêmes leur `truncate`.
 */
export async function seedRoles(): Promise<void> {
  for (const Seeder of ROLE_SEEDERS) {
    await new Seeder(db.connection()).run()
  }
}
