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

**PostgreSQL est le seul moteur supporté**, tests compris (version cible : voir [`postgres.md`](postgres.md)) : le schéma dépend de pgvector,
`tsvector`, des colonnes générées, de `text[]` et de contraintes `CHECK` posées en SQL brut.
`config/database.ts` n'expose plus qu'une connexion `pg` — il n'y a plus de variable
`DB_CONNECTION`, ni de repli SQLite (il ne faisait plus tourner les migrations, et testait
de toute façon un moteur différent de la production).

`.env.test` porte la configuration de la base de test (`127.0.0.1:5441`, base `test`), donc
**aucune variable à passer à la main** :

```bash
pnpm test:db   # docker compose --profile test up -d postgres_test
pnpm test
```

Le service `postgres_test` du `docker-compose.yml` écoute sur **5441** (les ports 5430-5439 sont pris
par d'autres projets) et stocke ses données en `tmpfs` — rien ne survit à l'arrêt du
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

#### Initialisation par groupe — `useDatabase`

`tests/utils/setup.ts` expose `useDatabase(group, options)`, qui branche le cycle de vie
base de données d'un groupe : **une fois par groupe**, `truncate()` (qui lance au passage
`migration:run`, idempotent) puis les seeders ; **avant chaque test**, une transaction globale
annulée à sa fin (rollback). Le `db:truncate` de fin de groupe est le cleanup du hook : le
groupe suivant repart d'une base vide. C'est le seul point d'entrée — on ne recopie plus les
hooks dans chaque spec.

Conséquence : un test peut muter les données semées sans polluer le suivant, et le catalogue
n'est plus re-semé à chaque test. Les `db.transaction()` du code testé deviennent des
savepoints. **Les séquences d'identifiants ne sont pas remises à zéro** par le rollback : ne
jamais écrire un `id` en dur dans un test.

```ts
useDatabase(group) // rôles + permissions (semés une fois), transaction par test
useDatabase(group, { seed: 'full' }) // MainSeeder (catalogue + dev user)
useDatabase(group, { seed: 'full', perTest: false }) // sans transaction par test (lecture seule)
useDatabase(group, { extraSeeders: [CategorySeeder] })
useDatabase(group, { seed: 'none' }) // vidage seul
```

| option         | valeurs                                                                 | défaut    |
| -------------- | ----------------------------------------------------------------------- | --------- |
| `seed`         | `'none'`, `'roles'`, `'full'`                                           | `'roles'` |
| `extraSeeders` | seeders joués après les précédents                                      | `[]`      |
| `perTest`      | `true` = transaction annulée par test, `false` = aucune (lecture seule) | `true`    |

`'full'` passe par `MainSeeder` et non `db:seed` : ce dernier exécuterait chaque seeder
isolément, donc `dev_user` avant les rôles.

Un groupe `perTest: false` n'est protégé par rien : il ne doit **jamais** écrire en base.

### Factories et helpers

Les entités socle se créent par **factory Lucid** (`database/factories/`), jamais par
`Model.create` inline : c'est ce qui a produit six variantes divergentes de « créer un
membre » — certaines oubliant `joined_at`, d'autres hachant le mot de passe une fois de
trop.

```ts
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationInvitationFactory } from '#database/factories/organization_invitation_factory'

await UserFactory.create() // email et nom aléatoires
await UserFactory.merge({ email: 'owner@example.com' }).create()
await UserFactory.apply('unverified').create() // email non vérifié (verrouillé par `emailVerified`)
await OrganizationFactory.apply('supplier').create() // états : supplier, both, archived
await OrganizationInvitationFactory.apply('expired')
  .merge({ organizationId: org.id, email: 'invited@example.com' })
  .create()

// Demandes de devis : les clés étrangères restent à fournir par l'appelant
const rfq = await RfqFactory.apply('published').merge({ buyerOrganizationId: org.id }).create()
await RfqItemFactory.merge({ rfqId: rfq.id, name: 'Tote bag', quantity: 100 }).create()
await RfqSupplierFactory.apply('sent') // états : (défaut `pending`), sent
  .merge({ rfqId: rfq.id, supplierOrganizationId: supplier.id })
  .create()
```

> Les utilisateurs sont **vérifiés par défaut** (`emailVerifiedAt` renseigné) : sans ça,
> le middleware `emailVerified` redirigerait chaque spec vers l'écran de vérification.
>
> Toute spec qui appelle `POST /signup` (ou change l'email d'un compte) met un mail en
> queue ; sous `QUEUE_DRIVER=sync` il part immédiatement. Il faut donc `mail.fake()` dans
> le groupe, sinon le test attend le timeout d'un vrai SMTP (~30 s) puis échoue.

> **Passkeys** : `FakeAuthenticator` (`tests/utils/fake_authenticator.ts`) joue le rôle du
> navigateur et de l'authentificateur (clé ES256, attestation `none`) : `register({ challenge })`
> et `authenticate({ challenge, counter })` produisent des réponses acceptées par la vraie
> vérification de `@simplewebauthn/server`. Le défi se pose en session avec
> `.withSession({ 'passkey.authentication': { value, expiresAt } })`, sans aller-retour par
> la route `options`. `PasskeyFactory` crée la ligne en base ; lui passer `credentialId` et
> `publicKey` de l'authentificateur pour une vraie connexion.

> Le mot de passe (`TEST_PASSWORD`, `'password123'`) est passé **en clair** : `User`
> compose `withAuthFinder`, dont le hook `beforeSave` le hache. Un `hash.make()` en amont
> produirait un hash de hash — invisible avec `loginAs`, mais un `POST /login` échouerait.

`tests/utils/organizations.ts` couvre les gestes qui touchent plusieurs tables :

| helper                                                     | rôle                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `joinOrganization(user, org, role?, { asCurrent })`        | adhésion (`joined_at` toujours renseigné)                       |
| `createMember(org, role?, overrides?, options?)`           | utilisateur **+** adhésion                                      |
| `createOrganizationWithOwner(overrides?, ownerOverrides?)` | organisation **+** son owner                                    |
| `createMemberOf(orgSlug, role?)`                           | membre d'une organisation déjà semée                            |
| `seededDevUser(orgSlug)`                                   | propriétaire de démo (seed `full`) basculé sur son organisation |

N'écrire une factory que pour une entité **créée directement par les specs**. Le catalogue
(produits, catégories, fournisseurs) passe par `MainSeeder` : il a besoin d'un jeu cohérent,
pas d'instances isolées.

### Exemple test fonctionnel

```ts
import { test } from '@japa/runner'

test.group('Users', (group) => {
  useDatabase(group)

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
- **`unstubGlobals: true`** : un `vi.stubGlobal(...)` (ex. `confirm`) est restauré entre deux tests

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

### Mocks Inertia partagés

Une page qui appelle `usePage()`, `useForm()` ou `<Head>` a besoin d'un mock de `@inertiajs/vue3`.
`tests/inertia/support/inertia_mocks.ts` en fournit les briques communes : `inertiaPage(translations)`,
`makeUseForm(spies?)`, `HeadStub`, `LinkStub`. Un `vi.mock` est hoisté au-dessus des imports : on
l'écrit avec une factory **asynchrone** qui importe le module à la demande. `translations`, propre au
spec, n'est lu qu'à l'appel de `usePage`.

```ts
vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { post: vi.fn() }, // propre au spec
    useForm: m.makeUseForm({ post }), // `post` : l'espion que le spec veut asserter
    Head: m.HeadStub,
  }
})
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})
```

`router`, `urlFor` (`vi.mock('~/client', …)`) et les mocks de composables (`use_passkey`) restent dans
le spec : ils varient trop pour être mutualisés sans changer ce que le test vérifie.
