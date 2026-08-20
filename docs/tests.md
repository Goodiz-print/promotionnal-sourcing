# Tests — Configuration et conventions

## Stack

| Couche                      | Framework                | Environnement                                               |
| --------------------------- | ------------------------ | ----------------------------------------------------------- |
| Backend (unit + functional) | Japa                     | PostgreSQL (`pgvector/pgvector:pg18`), en local comme en CI |
| Frontend (composants Vue)   | Vitest + @vue/test-utils | happy-dom                                                   |

---

## Backend — Japa

### Commandes

```bash
pnpm test:db                         # démarre la base de test (une fois)
pnpm test                            # toutes les suites
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

**PostgreSQL est le seul moteur supporté**, tests compris : le schéma dépend de pgvector,
`tsvector`, des colonnes générées, de `text[]` et de contraintes `CHECK` posées en SQL brut.
`config/database.ts` n'expose plus qu'une connexion `pg` — il n'y a plus de variable
`DB_CONNECTION`, ni de repli SQLite (il ne faisait plus tourner les migrations, et testait
de toute façon un moteur différent de la production).

`.env.test` porte la configuration de la base de test (`127.0.0.1:5433`, base `test`), donc
**aucune variable à passer à la main** :

```bash
pnpm test:db   # docker compose --profile test up -d postgres_test
pnpm test
```

Le service `postgres_test` du `docker-compose.yml` écoute sur **5433** (5432 est souvent pris
par un autre projet) et stocke ses données en `tmpfs` — rien ne survit à l'arrêt du
conteneur, c'est voulu.

Ordre de chargement AdonisJS : `.env.test.local` → `.env.test` → `.env`. Les valeurs de
`.env.test` écrasent donc celles de `.env`, mais une **vraie variable d'environnement** prime
sur les deux — c'est ainsi que la CI impose son propre hôte et son propre port sans toucher
au fichier.

#### Garde-fou : impossible de viser la base de dev

La suite tronque toutes les tables au fil des groupes. `tests/bootstrap.ts` refuse donc de
démarrer si `DB_DATABASE` ne se termine pas par `test` :

```
Base de données "promotionnal-sourcing_dev" refusée : la suite tronque toutes les tables
et n'accepte qu'une base dont le nom se termine par "test".
```

#### Initialisation par groupe

Il n'y a **aucun setup DB automatique** : chaque groupe qui touche la base l'initialise
lui-même via `testUtils.db()` — `migrate()` / `truncate()` / `seed()` /
`withGlobalTransaction()` (chacun sauf `seed` renvoie un cleanup à passer au hook Japa).
`truncate()` lance au passage `migration:run` (idempotent) et vide les tables au teardown, le
schéma étant conservé entre les groupes.

Pas de factories : semer via les seeders. On sème via `MainSeeder` (ordre des dépendances) et
non `db:seed`, qui exécuterait aussi chaque seeder isolément → `dev_user` avant les rôles.

```ts
test.group('Catalogue …', (group) => {
  group.setup(() => testUtils.db().truncate())
  group.setup(() => new MainSeeder(db.connection()).run())
  // tests…
})
```

Pour isoler chaque test dans une transaction annulée :

```ts
test.group('Mon groupe', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
})
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
