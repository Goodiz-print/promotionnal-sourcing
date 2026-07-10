# Tests — Configuration et conventions

## Stack

| Couche                      | Framework                | Environnement                                                            |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| Backend (unit + functional) | Japa                     | SQLite (défaut) · PostgreSQL pour le catalogue (CI / `DB_CONNECTION=pg`) |
| Frontend (composants Vue)   | Vitest + @vue/test-utils | happy-dom                                                                |

---

## Backend — Japa

### Commandes

```bash
node ace test                        # toutes les suites
node ace test --suites=unit          # tests unitaires uniquement
node ace test --suites=functional    # tests fonctionnels uniquement
```

### Suites

Configurées dans `adonisrc.ts` :

- **unit** → `tests/unit/**/*.spec.ts` (timeout 2s)
- **functional** → `tests/functional/**/*.spec.ts` (timeout 30s)
- **browser** → `tests/browser/**/*.spec.ts` (timeout 300s)

### Bootstrap (`tests/bootstrap.ts`)

Plugins Japa enregistrés :

- `assert()` — assertions classiques
- `apiClient()` — client HTTP pour les tests fonctionnels (`client.get(...)`)
- `pluginAdonisJS(app)` — intégration AdonisJS (IoC, providers)
- `dbAssertions(app)` — assertions base de données Lucid
- `inertiaApiClient(app)` — `.withInertia()`, `assertInertiaPropsContains(...)`, `response.inertiaProps`
- `sessionApiClient(app)` — session/`loginAs` sur les requêtes
- `shieldApiClient()` — `.withCsrfToken()`

### Base de données en test

`config/database.ts` : en test, la connexion suit `DB_CONNECTION` (défaut **SQLite**,
fichier `tmp/db.sqlite3`). **La CI force `DB_CONNECTION=pg`** (image `pgvector/pgvector:pg18`).

Il n'y a **aucun setup DB automatique** (`runnerHooks` vides) : chaque groupe qui touche
la base l'initialise lui-même via `testUtils.db()` — `migrate()` / `truncate()` / `seed()`
/ `withGlobalTransaction()` (chacun sauf `seed` renvoie un cleanup à passer au hook Japa).
Pas de factories : semer via les seeders.

Pour isoler chaque test dans une transaction annulée :

```ts
test.group('Mon groupe', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
})
```

#### Catalogue : tests gardés par dialecte (PostgreSQL)

Le catalogue utilise des fonctionnalités **PostgreSQL** (pgvector, `tsvector`, colonnes
générées) absentes de SQLite. Les groupes catalogue sont donc gardés par
`isPostgres()` (`tests/utils/database.ts`) : exécutés sous Postgres (CI + `DB_CONNECTION=pg`
en local), **sautés** sinon. On sème via `MainSeeder` (ordre des dépendances) et non
`db:seed` (qui exécuterait aussi chaque seeder isolément → `dev_user` avant les rôles).

```ts
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import db from '@adonisjs/lucid/services/db'

test.group('Catalogue …', (group) => {
  if (isPostgres()) {
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'Catalogue : PostgreSQL requis'))
  }
  // tests…
})
```

En local, lancer la suite Postgres avec :

```bash
NODE_ENV=test DB_CONNECTION=pg DB_DATABASE=test pnpm test
```

### Exemple test fonctionnel

```ts
import { test } from '@japa/runner'

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('liste les utilisateurs', async ({ client }) => {
    const response = await client.get('/users')
    response.assertStatus(200)
  })

  test('crée un utilisateur', async ({ client }) => {
    const response = await client.post('/users').json({
      email: 'test@example.com',
      password: 'secret1234',
    })
    response.assertStatus(201)
  })
})
```

### Exemple test unitaire

```ts
import { test } from '@japa/runner'
import { MyService } from '#services/my_service'

test.group('MyService', () => {
  test('calcule correctement', ({ assert }) => {
    const result = MyService.compute(2, 3)
    assert.equal(result, 5)
  })
})
```

---

## Frontend — Vitest

### Commandes

```bash
pnpm run test:inertia          # run one-shot
pnpm run test:inertia -- --watch   # mode watch
```

### Configuration (`vitest.config.ts`)

- **Environnement** : `happy-dom`
- **Include** : `tests/inertia/**/*.spec.ts`
- **Alias** : `~/` → `inertia/`, `@generated` → `.adonisjs/client/`

### Exemple test composant

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '~/components/MyComponent.vue'

describe('MyComponent', () => {
  it('affiche le titre', () => {
    const wrapper = mount(MyComponent, {
      props: { title: 'Bonjour' },
    })
    expect(wrapper.find('h1').text()).toBe('Bonjour')
  })

  it('émet un événement au clic', async () => {
    const wrapper = mount(MyComponent)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
```

### Tester avec Inertia / props de page

Pour tester une page Inertia, passer les props directement via `mount` — pas besoin de simuler Inertia :

```ts
import { mount } from '@vue/test-utils'
import HomePage from '~/pages/home.vue'

it('affiche les données', () => {
  const wrapper = mount(HomePage, {
    props: { items: [{ id: 1, name: 'Test' }] },
  })
  expect(wrapper.findAll('li')).toHaveLength(1)
})
```
