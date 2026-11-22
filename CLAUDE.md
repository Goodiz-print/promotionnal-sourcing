# CLAUDE.md — Contexte Global

> Contexte produit (pitch, positionnement concurrentiel, critères de sourcing) : voir [`docs/product-context.md`](docs/product-context.md).

## Stack principale

- **Backend** : AdonisJS v7 (TypeScript strict)
- **Frontend** : Vue 3 (Composition API) + Inertia.js (SSR)
- **Base de données** : PostgreSQL via Lucid ORM (y compris en test)
- **Recherche** : Meilisearch hébergé sur Clever Cloud (instance Docker, recherche hybride : mots-clés + vecteurs). Les embeddings sont calculés par l'application (`EmbeddingService`, provider configurable, `mistral-embed` par défaut), conservés dans PostgreSQL et poussés dans l'index (`userProvided`). Index alimenté depuis PostgreSQL par la queue, PostgreSQL reste la source de vérité (issue #112, ADR 0002, `docs/search.md`)
- **ORM** : Lucid (migrations, seeders)
- **Auth** : @adonisjs/auth avec bouncer + abilities pour les ACL
- **IA** : Mistral AI via `@mistralai/mistralai` + système de queue AdonisJS
- **Tests backend** : Japa (functional + unit)
- **Tests frontend** : Vitest + @vue/test-utils
- **Package manager** : pnpm
- **Déploiement** : Clever Cloud (applications Docker web et worker, PostgreSQL managé, Cellar, Meilisearch) + CI/CD GitHub Actions (ADR 0003, `docs/deploiement.md`)

## Dépendances système

### Cellar (stockage des fichiers — Clever Cloud, API S3)

Les fichiers (galerie produit, logos…) sont stockés sur Cellar. Détail et invariants : [`docs/storage.md`](docs/storage.md).

- **Config** : `config/storage.ts` ; env `CELLAR_ENDPOINT`, `CELLAR_BUCKET`, `CELLAR_ACCESS_KEY_ID`, `CELLAR_SECRET_ACCESS_KEY` (validées dans `start/env.ts`, documentées dans `.env.example`).
- **Abstraction** : `StorageDriver` (classe abstraite, `app/services/storage/`) liée à `CellarStorageDriver` dans `providers/storage_provider.ts`. Les services injectent `StorageService`, jamais le driver directement.
- **Clé déterministe imposée** : `promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>` — jamais de nom aléatoire (casserait le dédoublonnage).
- **Zéro orphelin** : registre `storage_objects` (`pending_upload` → `ready` → `pending_delete`). Tout upload passe par `StorageService.store`, tout remplacement/suppression de référence par `StorageService.release` **dans la transaction** qui met la référence à jour. Toute nouvelle colonne qui référence un fichier s'ajoute à `STORAGE_REFERENCES` (`shared/types/storage.ts`).

### Ghostscript (compression PDF)

Les documents PDF des fournisseurs (catalogue, certificat, fiche technique) sont compressés avant stockage : `app/services/pdf_service.ts` appelle `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook` via la classe abstraite `GhostscriptRunner` (liée dans `providers/pdf_provider.ts`).

- **Local** : `brew install ghostscript`
- **Docker/prod** : `apt-get install -y ghostscript` dans le Dockerfile
- **Repli** : si `gs` est absent, échoue ou n'allège pas le fichier, le PDF original est stocké avec un warning loggé. Jamais de crash.
- **Stockage** : via `DocumentService` → `StorageService` (Cellar), comme les autres fichiers.

## Conventions de code

### TypeScript

- Strict mode activé (`"strict": true`)
- Interfaces préférées aux types pour les objets
- Pas de `any` — utiliser `unknown` si nécessaire
- Nommage : `camelCase` pour variables/fonctions, `PascalCase` pour classes/interfaces
- **Fonctions de tableau plutôt que boucles** : privilégier `map` / `filter` / `reduce` / `flatMap` / `some` / `every` / `find`, et `Map.groupBy` / `Object.fromEntries` / `new Set(...)` pour regrouper ou indexer, plutôt que des boucles `for` / `for…of` / `for…in` qui mutent un accumulateur — code plus lisible et plus testable. Une boucle reste acceptable seulement si elle est réellement plus claire : `await` qui doivent s'exécuter **séquentiellement**, sortie anticipée (`break`) sur un gros volume. Pour des écritures indépendantes, `Promise.all(items.map(...))`.
- **Fonctions simples et courtes** : une fonction fait **une seule chose**, nommée par ce qu'elle fait. Dès qu'une fonction devient complexe, la découper en fonctions (ou méthodes `private`) nommées et testables :
  - **~30 lignes** au plus ; au-delà, extraire des étapes nommées ;
  - **2 niveaux d'imbrication** au plus (`if` / boucle / callback) : préférer les **retours anticipés** (guard clauses) aux `if` imbriqués et aux `else` après un `return` ;
  - **3 paramètres** au plus ; au-delà, un objet typé (dans `shared/types/`) ;
  - pas de **ternaires imbriqués** ni de longues chaînes `if / else if` : une table de correspondance (`Record<Clé, Valeur>`) ou des fonctions dédiées ;
  - conditions longues extraites dans une **variable ou fonction au nom explicite** (`const isEligible = …`) ;
  - séparer le **calcul pur** (testable sans base ni HTTP) des **effets** (requêtes, écritures, appels externes) : la règle métier vit dans une fonction pure, le service orchestre.
  - **Vérifié par ESLint** (`eslint.config.js`, bloc « readability ») en `warn` : boucles et plus de 3 paramètres (`no-restricted-syntax`, constructeurs exclus pour l'injection), `complexity` 10, `max-depth` 2, `max-lines-per-function` 30, `no-nested-ternary`, `no-else-return`. Le code existant n'est pas encore conforme : **tout fichier créé ou modifié ne doit ajouter aucun de ces warnings**.

### AdonisJS

- Controllers fins : logique métier dans les Services (`app/services/`)
- Un fichier par ressource : `user_service`, etc.
- Validation via VineJS (validators dans `app/validators/`)
- Transformers dans `app/transformers/` pour formater les données envoyées au frontend
- Routes RESTful : nommage `resource.action` (ex: `users.index`, `users.store`)
- Routes découpées par domaine dans `start/routes/` (auth.ts, boats.ts, ai.ts…)
- Middleware dans `app/middleware/`
- Events dans `app/events/` + Listeners dans `app/listeners/`
- Abilities (Bouncer) dans `app/abilities/`
- **Règles d'autorisation = abilities Bouncer (OBLIGATOIRE)** : toute décision « cet utilisateur peut-il… / est-il… » (rôle dans l'organisation, type d'organisation, appartenance, droit plateforme) s'écrit comme une **ability** dans `app/abilities/main.ts` et s'appelle par `bouncer.authorize` / `bouncer.allows` / `bouncer.denies`. Jamais de méthode privée de controller ni de condition inline qui combine type d'organisation, rôle et `bouncer.*` pour en déduire un droit : la règle doit être nommée, réutilisable et testable au même endroit que les autres.
- Jobs de queue dans `app/jobs/`
- **Types des controllers/services dans `shared/types/`** : tout type utilisé dans un controller ou service doit vivre dans `shared/types/<domaine>.ts` — jamais défini inline ou dans `app/`. Le frontend importe directement ces types quand pertinent (props, composables, stores).
- **Toute fonction utilitaire vit dans un fichier utilitaire et est testée (OBLIGATOIRE)** : toute fonction utilitaire (calcul pur, formatage, parsing, normalisation, conversion, règle métier sans effet), **où qu'elle soit nécessaire** (controller, service, job, command, listener, validator, transformer, middleware, composant Vue, composable, page), vit dans `shared/helpers/<domaine>.ts`, exportée et **testée unitairement** (`tests/unit/`) dans la même modification. Jamais de fonction utilitaire définie en module-level ou en méthode `private` d'un autre fichier, ni dans le `<script setup>` d'un composant, sauf **très bonne raison** (elle dépend d'un état injecté de la classe, ou n'est qu'une étape d'orchestration à effets) — la justifier alors par un commentaire. Avant d'en créer une, chercher si un helper existant la couvre déjà. Le service orchestre (requêtes, écritures, appels externes), le helper calcule.
- **Tout service créé ou modifié est testé (OBLIGATOIRE)** : un service nouveau a sa spec ; un service modifié voit sa spec mise à jour dans la même modification (nouvelle méthode → nouveaux tests, comportement changé → tests adaptés, cas limites et erreurs inclus). Chaque méthode publique est testée contre la base PostgreSQL avec les factories, les dépendances externes remplacées par `container.swap`. Aucune modification de service ne part sans test qui la couvre.
- **Tout transformer créé ou modifié est testé (OBLIGATOIRE)** : chaque transformer de `app/transformers/` a sa spec unitaire (`tests/unit/transformers/<nom>.spec.ts`), ajoutée ou mise à jour dans la même modification. Elle vérifie la forme exacte de l'objet produit (champs exposés, valeurs calculées, `null` et relations absentes), et surtout que **les champs sensibles ne fuient pas** (hash, ids internes, jetons, données d'une autre organisation). Le modèle se construit avec les factories (`useDatabase(group)` si la persistance est nécessaire) ; une conversion pure appelée par le transformer va dans `shared/helpers/` avec son propre test.
- **Classes d'erreur dans `app/exceptions/`** : toute classe d'erreur métier doit vivre dans `app/exceptions/<domaine>_errors.ts` — jamais définie inline dans un controller ou service.
- **Injection de dépendances (OBLIGATOIRE)** : ne **jamais** instancier un service applicatif ou une classe injectable avec `new` dans un controller / service / job / command. Utiliser le **conteneur IoC** d'AdonisJS ([doc](https://docs.adonisjs.com/guides/concepts/dependency-injection)) :
  - Décorer la classe consommatrice avec `@inject()` (`import { inject } from '@adonisjs/core'`) et déclarer les dépendances **dans le constructeur** (typées par leur classe). Les **controllers** reçoivent ainsi leurs services par injection constructeur (le routeur les résout via le conteneur).
  - Résoudre à la demande (jobs, commands) via `app.container.make(Service)` (`import app from '@adonisjs/core/services/app'`, ou `this.app.container.make(...)` dans une command) — jamais `new Service()`.
  - Pour une **abstraction** (plusieurs implémentations : providers IA, drivers de paiement…), le token d'injection est une **classe abstraite** (les interfaces n'existent pas au runtime). Lier l'implémentation dans un **service provider** (`providers/*.ts`) : `container.singleton(AbstractClass, (resolver) => resolver.make(Impl))`, puis **injecter la classe abstraite**.
  - Une **command** ace reçoit ses dépendances par **injection de méthode** : décorer `run()` avec `@inject()` et typer les paramètres (ace exécute `run` via `container.call`).
  - En **test**, remplacer une dépendance via `container.swap(Class, () => fake)` (+ `container.restore(Class)`), ou construire directement le SUT en passant le faux au constructeur.
  - Les **services singletons du framework** (`db`, `logger`, `hash`, `mail`, `i18n`…) restent accessibles via leurs modules `@adonisjs/*/services/*` : c'est leur API prévue, ce n'est pas du `new`.
- **Imports en haut du fichier (OBLIGATOIRE)** : importer services, modèles, config, transformers… **au sommet** du module — **jamais** d'`await import(...)` dynamique à l'intérieur d'une fonction/méthode (on injecte à la place). **Seule exception**, un **module de job** (`app/jobs/**`) ne doit **pas** importer statiquement un **modèle Lucid** (ni quoi que ce soit qui en importe un) : la queue charge les jobs **au boot** (`loadJobs`), et évaluer un modèle à ce stade casse la résolution du service `hash` (`@adonisjs/auth`) → hachage cassé au seeding. Dans un job : injecter les **services** par constructeur (`@inject()`, import statique OK — un service ne doit importer les modèles qu'en `import type`) et importer le **modèle** via `await import('#models/…')` **dans `execute()`** uniquement (commenter pourquoi). Controllers et commands (chargés après le boot) n'ont **pas** cette contrainte.

### Base de données

- Migrations : toujours avec rollback (`down()` implémenté)
- Nommage tables : snake_case pluriel (`user_profiles`, `refresh_tokens`)
- Seeders pour les données de démo (`database/seeders/`)
- Jamais de `SELECT *` en production — colonnes explicites

### Frontend (Vue 3 + Inertia)

- `<script setup>` systématiquement
- Pages dans `inertia/pages/` (organisées par domaine : auth, boats, marketing…)
- Composants dans `inertia/components/`
- Composables dans `inertia/composables/`
- Props typées avec `defineProps<{}>()`, pas d'Options API
- Code partagé backend/frontend dans `shared/` (types, helpers, constants)
- **Taille max des composants Vue : 250 lignes** (enforced par ESLint `max-lines`) — au-delà, extraire en sous-composants
- Pages complexes à onglets : chaque onglet = un composant dans `components/<domaine>/show/tabs/`
- **Design system obligatoire** (`docs/design-system.md`) : toute page applicative utilise `BasePageHeader` (jamais de `<h1>` à la main), `BaseSection`/`BaseCard` pour ses blocs, `BaseTable` pour un tableau, `BaseEmptyState` pour un état vide, `BaseDropdown` pour un menu, `BaseButton`/`BaseLinkButton` pour les actions, les champs `Base*` pour les formulaires, et les icônes **lucide-vue-next** (jamais d'emoji ni de glyphe texte). Couleurs et typographie par les utilitaires du DS (`bg-card`, `border-hairline`, `text-text-secondary`, `text-body-sm`, `text-heading-md`…) — **interdits dans du code neuf** : `text-[NNpx]`, `tracking-[…]`, `rounded` nu, `var(--gray-*)`, `var(--primary-*)`, couleurs hex en dur. Les styles d'éléments vont dans `@layer base` de `inertia/css/app.css` (jamais de règle non layerée : elle écraserait les utilitaires Tailwind).
- **Extraire les composants génériques** : dès qu'un groupe de balises de template se répète (même structure label/champ/erreur, bouton, carte, badge…) ou pourrait être réutilisé ailleurs, l'extraire en **composant générique** dans `inertia/components/base/` (préfixe `base_*` : `base_input`, `base_select`, `base_button`…) plutôt que de dupliquer le markup et les classes Tailwind. Le composant est paramétré par `props` + `slots` ; le rendre **générique** (`<script setup lang="ts" generic="T …">`) quand le `v-model` doit conserver le type du champ lié (ex. `number | null`, union). Ne jamais copier-coller deux fois le même bloc de champ/contrôle : c'est le signal d'un composant à créer.

#### Mutations Inertia (obligatoire sur pages/composants Inertia)

Sur tout écran rendu par Inertia (`inertia/pages/**`, `inertia/components/**`), **ne jamais** appeler `fetch` / `axios` avec `Content-Type: application/json` ni gérer le CSRF à la main (`X-XSRF-TOKEN`, lecture du cookie).

**À la place :**

- Formulaires : `<Form>` (`@adonisjs/inertia/vue`) ou `useForm` + `form.post` / `form.patch`…
- Actions ponctuelles (drag, toggle, assignation canvas…) : `router.patch` / `router.post` / `router.put` / `router.delete` avec `preserveScroll: true` ; partial reload via `only: ['nomDeProp']` quand seule une prop change
- CSRF : automatique via Shield + client Inertia (pas de helper `getCsrf()`)

**Côté contrôleur** (routes utilisées par ces écrans) :

- Répondre par **redirection Inertia** : `response.redirect().back()` ou `response.redirect('/chemin')` — **pas** `response.json({ ok: true })`
- Validation VineJS + erreurs de session comme pour les autres formulaires Inertia

**Exceptions autorisées** : endpoints dédiés API (`/api/**`, clients externes, exports) — jamais dans un composant/page Inertia si une visite `router.*` ou un `<Form>` suffit.

Références : [Inertia — Link and Form](https://docs.adonisjs.com/guides/frontend/inertia#link-and-form-components), [Manual visits](https://inertiajs.com/manual-visits).

## Workflow agent

1. **Toujours lire les fichiers existants** avant de modifier
2. **Plan d'abord** : décrire ce qui va être fait avant de coder
3. **Tests obligatoires pour toute fonction ajoutée ou modifiée** — **tout controller et tout service est toujours testé** (functional pour chaque route/action du controller, cas nominal + refus d'autorisation + erreur de validation ; chaque méthode publique du service contre la base) ; et pas seulement la « logique métier » : services, helpers purs, abilities, transformers, jobs, commands, composables. Le test s'écrit **dans la même modification** que la fonction, en suivant la doc [Japa](https://japa.dev/docs) et [AdonisJS — Testing](https://docs.adonisjs.com/guides/testing/introduction) : unitaire pour le calcul pur, functional pour les routes, services testés contre la base avec les factories, dépendances externes remplacées par `container.swap`, composants/composables Vue via Vitest. Si une fonction ne peut vraiment pas être testée, le signaler explicitement. La suite tourne sous **PostgreSQL** (`pnpm test:db && pnpm test`) ; un groupe branche sa base avec `useDatabase(group)` (`tests/utils/setup.ts`) et crée ses entités socle avec les **factories** de `database/factories/` + les helpers de `tests/utils/organizations.ts` — jamais de `Model.create` inline pour un utilisateur, une organisation, une adhésion ou une invitation (voir `docs/tests.md`)
4. **Pas de `console.log`** en commit — utiliser le logger Adonis
5. **Migrations** : ne jamais modifier une migration déjà exécutée en production
6. **Documentation obligatoire** : toute nouvelle feature doit être ajoutée dans un **nouveau fichier** `docs/changelog/AAAA-MM-JJ-slug.md` (un fichier par nouveauté, format dans `docs/changelog/README.md`) avec la date et une description en français (routes, champs, comportements notables)

## Structure projet

```
app/
  controllers/     # HTTP Controllers (fins)
  services/        # Logique métier
  models/          # Modèles Lucid
  validators/      # VineJS validators
  transformers/    # Formatage des données → frontend
  middleware/      # Middleware HTTP
  abilities/       # Bouncer abilities (ACL)
  jobs/            # Background jobs (queue)
  events/          # Event definitions
  listeners/       # Event listeners
config/
database/
  migrations/
  seeders/
inertia/           # Frontend Vue 3 + Inertia
  pages/           # Pages par domaine (auth, boats, marketing…)
  components/      # Composants Vue
  composables/     # Composables Vue
  types/           # Types frontend
shared/            # Code partagé backend ↔ frontend (types, helpers, constants)
  types/           # Types des controllers/services — un fichier par domaine (port.ts, boat.ts…)
providers/         # Service providers AdonisJS
start/
  routes/          # Routes découpées par domaine
  routes.ts
  kernel.ts
  scheduler.ts
tests/
  functional/      # Tests Japa (HTTP)
  inertia/         # Tests Vitest (composants Vue)
```

## Ne jamais faire

- Modifier `start/kernel.ts` sans vérifier les effets de bord
- Utiliser `Model.query()` dans un Controller (→ déléguer au Service)
- **Écrire une règle d'autorisation dans un controller** (méthode privée `isXxxWithoutRights`, test de rôle ou de type d'organisation combiné à `bouncer.*`) (→ ability Bouncer dans `app/abilities/main.ts`)
- **Instancier un service / une classe injectable avec `new`** dans un controller / service / job / command (→ injection de dépendances via `@inject` + conteneur IoC ; abstraction = classe abstraite liée dans un service provider — voir la règle DI)
- Committer des secrets ou `.env`
- Supprimer des migrations existantes
- Mettre de la logique de formatage dans les controllers (→ utiliser un transformer)
- **Définir des types de controllers/services ailleurs que dans `shared/types/`** (→ un fichier par domaine dans `shared/types/`, réutilisé côté front)
- **Créer ou modifier un service, un controller ou un transformer sans ajouter ou mettre à jour ses tests** dans la même modification
- **Définir une fonction utilitaire ailleurs que dans un fichier utilitaire**, ou sans test unitaire (→ `shared/helpers/<domaine>.ts` + `tests/unit/`, sauf très bonne raison commentée)
- **Définir des classes d'erreur inline dans un controller ou service** (→ `app/exceptions/<domaine>_errors.ts`)
- **Écrire du texte visible en dur dans un template Vue** (→ utiliser `t('clé')`)
- **Contourner le design system** : `<h1>`/`<table>`/`<details>` à la main, `text-[32px]`, `var(--gray-*)`, emoji en guise d'icône (→ composants `Base*`, utilitaires DS, lucide ; voir `docs/design-system.md`)
- **Ajouter une clé à `resources/lang/fr/quote.json` sans l'ajouter aux 8 autres langues** (→ `tests/unit/translations.spec.ts` impose les mêmes clés dans les 9 langues ; lancer `node ace test unit --files=tests/unit/translations.spec.ts` avant de pousser)
- **Utiliser des ternaires `locale === 'fr' ? ... : ...`** (→ utiliser `t()` avec clé dans les deux JSON)
- **`fetch` / `axios` + JSON + CSRF manuel dans `inertia/**`** pour des mutations déjà couvertes par une page Inertia (→ `router.patch`/`useForm`/`<Form>`+`response.redirect().back()` côté contrôleur)
- **`response.json({ ok: true })` sur des routes appelées depuis l’UI Inertia** (→ redirection ; réserver le JSON aux vraies routes API)
- **Dupliquer un bloc de template / des classes Tailwind** entre plusieurs champs ou écrans (→ extraire un composant générique `inertia/components/base/base_*`)
- **Recopier un helper de fixtures dans une spec** (`makeUser`, `makeMember`, hooks de seeders…) (→ factories `database/factories/` + `tests/utils/`)
