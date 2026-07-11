# Catalogue produits

Socle de données du catalogue (fournisseurs, catégories, attributs, produits),
**conçu dès le départ pour la recherche multi-critères fiable** : filtrer
« crayon ET bleu » doit renvoyer uniquement des crayons bleus, jamais un
produit bleu au hasard. Ce document couvre le modèle de données et l'i18n du
contenu ; le service d'embeddings, le moteur de recherche et le parseur de
requête arrivent dans un incrément ultérieur.

## Tables

- **`suppliers`** — fournisseur européen (slug, `country_code` ISO2, contact,
  `is_active`). Texte (nom, description) déporté dans `supplier_translations`.
  Depuis la Phase 2, porte aussi `organization_id` (fiche rattachée à une
  organisation fournisseur) — voir `docs/organisations.md`.
- **`categories`** — taxonomie auto-référencée (`parent_id` → `categories.id`,
  `ON DELETE SET NULL`) + `synonyms text[]` (pour le futur parseur de requête).
  Texte dans `category_translations`.
- **`attributes`** — définitions de facettes : `slug`, `type` enum
  (`string|number|boolean|enum`), `unit`, `is_filterable`. Texte (`name`)
  dans `attribute_translations`.
- **`attribute_values`** — valeurs énumérées d'un attribut (`value` canonique,
  `slug`, `synonyms text[]`), unique `(attribute_id, slug)`. Texte (`label`)
  dans `attribute_value_translations`.
- **`products`** — cœur du catalogue : FK `supplier_id` (`CASCADE`),
  `category_id` (`RESTRICT`), `slug` unique, `reference`, `price_min`/`price_max`
  (`decimal(12,2)`), `currency` (défaut `EUR`), `min_quantity`, `image_url`,
  `origin_country` (ISO2), `made_in_europe`, `is_active`, `embedding
vector(1024)`. Texte (`name`, `description`) dans `product_translations`.
- **`product_attributes`** — pivot facettes, **le mécanisme du ET fiable** :
  `(product_id, attribute_id, attribute_value_id)` unique + `value_number`/
  `value_string` pour les attributs numériques libres (ex. grammage) sans
  valeur énumérée. Index `(attribute_id, attribute_value_id)` pour le
  filtrage à facettes.

Migrations : `database/migrations/…948` (extensions) → `…954` (tables de
base), voir aussi la section i18n ci-dessous pour `…955`→`…960`.

## Le mécanisme du « ET » fiable

Le filtrage multi-critères s'appuie sur des relations réelles plutôt que sur
du texte libre : `whereHas('category')` + `whereHas('attributeValues', …)`
sur `product_attributes` combine plusieurs facettes en `AND` SQL. Voir
`tests/functional/catalogue.spec.ts` pour la preuve (crayon + bleu → 2
crayons bleus, jamais un produit bleu non-crayon).

## Vectorisation & full-text (PostgreSQL uniquement)

Migration `…948_enable_search_extensions` active `vector` (pgvector),
`pg_trgm` (recherche floue) et `unaccent` (normalisation FR côté requête) —
no-op hors PostgreSQL.

- **`products.embedding`** — `vector(1024)`, nullable, index **HNSW**
  (`vector_cosine_ops`). Peuplé par le job `generate_product_embedding_job`
  (`mistral-embed`) — voir « Recherche sémantique » ci-dessous.
- **`product_translations.search_vector`** — colonne générée **immuable**,
  un `CASE` par `locale` (`to_tsvector('french', …)` / `to_tsvector('english',
…)`, repli `'simple'`) + index GIN. `unaccent()` est `STABLE` et interdit
  dans une colonne `GENERATED` : il est appliqué côté requête, pas en
  stockage.
- Ajouter une langue à la recherche plein-texte = ajouter une entrée dans
  `LOCALE_TSCONFIG` (`shared/types/i18n.ts`) **et** une branche `WHEN` dans
  la migration `…959_create_product_translations_table`.

`database/schema_rules.ts` exclut `products.embedding` et
`product_translations.search_vector` du schéma généré par l'ORM (colonnes
SQL brutes, jamais typées/sérialisées).

## Recherche sémantique (embeddings Mistral)

En complément du full-text (correspondance lexicale), le catalogue offre une
**recherche sémantique** : des produits pertinents remontent même sans mot-clé
exact (« stylo écologique » → produits verts).

- **Provider-agnostique** — `AI_PROVIDER` choisit le driver d'embeddings :
  `mistral` (SDK natif) ou `openai-compatible` (driver générique HTTP parlant le
  protocole OpenAI `/embeddings` : OpenAI, Together, Groq, Ollama, vLLM, LM
  Studio… via `AI_BASE_URL` / `AI_API_KEY` / `AI_EMBED_MODEL`). Chaque driver
  implémente l'interface `EmbeddingProvider` (`shared/types/ai.ts`) et est résolu
  par `provider_factory.ts`. Ajouter un provider = un fichier dans
  `app/services/embeddings/` + un `case` dans la factory.
- **Config** `config/ai.ts` + `AI_EMBEDDINGS_ENABLED` (défaut **faux** →
  désactivée en dev/test/CI, aucun appel réseau). La **dimension est figée à
  1024** (colonne `products.embedding`) : chaque provider est configuré pour
  réduire à 1024 (`outputDimension` Mistral, `dimensions` OpenAI) ; un vecteur
  d'une autre taille lève `EmbeddingDimensionError`.
- **Génération** — `EmbeddingService` (provider injecté, testable) calcule
  l'embedding depuis `productText` (nom + description, toutes locales) et l'écrit
  en `products.embedding` (`?::vector`). Déclenchée en asynchrone par le job
  `generate_product_embedding_job`, dispatché à la création/mise à jour d'un
  produit (`supplier_product_service`, dispatch résilient — un échec queue ne
  casse jamais l'écriture produit).
- **Requête** — `products_controller` calcule (best-effort) l'embedding du terme
  recherché quand l'IA est active ; `product_catalogue_service.list` trie alors
  par distance cosinus (`embedding <=> ?::vector`, index HNSW) parmi les produits
  vectorisés. **Repli automatique** sur le full-text si l'IA est indisponible ou
  la requête non vectorisée.
- **Backfill** — `node ace embeddings:backfill` (re)génère les embeddings
  manquants (produits importés en masse, activation initiale).

## Catalogue public (lecture)

Écran acheteur public (sans auth), sous le préfixe de locale (`/fr`, `/en`) :

- **Routes** : `GET /products` (`products.index`, liste filtrée/paginée) et
  `GET /products/:slug` (`products.show`, fiche). Produit inactif/inconnu → 404
  (`ProductNotFoundException`, `app/exceptions/catalogue_errors.ts`).
- **Service** : `app/services/product_catalogue_service.ts` — toute la logique ORM
  (controller fin `products_controller.ts`). `PER_PAGE = 12`.
- **Recherche full-text locale-aware** : sur `product_translations.search_vector`
  via `websearch_to_tsquery(<config locale>, terme)` (texte libre utilisateur, sans
  sanitizer). La config vient de `LOCALE_TSCONFIG` (`fr`→`french`, `en`→`english`,
  repli `simple`) ; la requête est scopée à la traduction de la locale active.
- **Filtres** : catégorie (`categoryId`), made-in-Europe (`madeInEurope`), et
  **facettes attributs** (`attributeValueIds[]`) en **ET fiable** — un `whereHas`
  par valeur sélectionnée, cf. la section « ET » ci-dessus.
- **Facettes exposées à l'UI** : `availableCategories()` (catégories ayant au moins
  un produit actif) + `filterableAttributes()` (attributs `is_filterable` + valeurs).
- **Frontend** : `inertia/pages/products/{index,show}.vue`, barre de filtres
  `inertia/components/catalogue_filters.vue` (+ générique `base_checkbox.vue`),
  cartes `product_card.vue`. i18n : `resources/lang/{fr,en}/products.json`.

> Hors périmètre de cette tranche : CRUD fournisseur (dépend de l'auth fournisseur),
> recherche sémantique par embeddings (`products.embedding` reste `NULL`),
> ranking `ts_rank`, tolérance typo `pg_trgm`.

## Images produit (galerie + Cloudinary)

Un produit porte une **galerie** d'images ordonnées, hébergées sur Cloudinary.

- **Stockage** : table `product_images` (one-to-many) — `product_id` (CASCADE),
  `secure_url`, `public_id` (unique, requis pour supprimer l'asset), `position`
  (ordre, unique par produit), `width`/`height`. Modèle `app/models/product_image.ts`
  (`Product hasMany images`). URL/position **neutres** (pas de localisation) ; des
  alt/légendes localisés suivraient le précédent `product_translations` (hors v1).
- **`products.image_url`** : conservé comme **image principale dénormalisée**
  (repli affichage + cartes catalogue) ; la galerie complète vit dans `product_images`.
- **Upload** : `app/services/cloudinary_service.ts` (`uploadMany`/`upload`/`destroy`),
  dossier imposé `promotionnal-sourcing/<environnement>/products/<slug>` ; validateur
  multi-fichiers réutilisable `app/validators/product_image.ts`
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8). Le service et le
  validateur sont prêts ; **l'écran d'upload fournisseur** sera branché avec le CRUD
  produit fournisseur.
- **Affichage** : `ProductDetailTransformer` expose `images` (triées par `position`) ;
  fiche `inertia/pages/products/show.vue` via `inertia/components/product_gallery.vue`
  (image principale + miniatures, repli sur `imageUrl`).

## Gestion produit fournisseur (CRUD + upload)

Écran **authentifié** permettant à un fournisseur de gérer ses produits (org courante).

- **Routes** (préfixe `:locale`, middleware `auth` + `onboarded`) :
  `GET /supplier/products` (`.index`), `GET /supplier/products/new` (`.create`),
  `POST /supplier/products` (`.store`), `GET /supplier/products/:id/edit` (`.edit`),
  `POST /supplier/products/:id` (`.update` — **POST** pour porter le multipart),
  `DELETE /supplier/products/:id` (`.destroy`).
- **Autorisation** : ability `canManageProducts` (`app/abilities/main.ts`) — org
  `supplier`/`both` + membre `owner`/`admin`. L'ownership est garanti côté service
  (`findOwned` : produit dont le fournisseur appartient à l'org → sinon 404).
- **Rattachement org → produits** : un produit appartient à un `Supplier`, lui-même
  rattaché à une organisation. `SupplierProductService.resolveSupplier(org)` fait un
  **get-or-create** du fournisseur de l'org (nom = nom de l'org, slug dérivé, pays de
  l'org) : un org fraîchement onboardé peut donc créer des produits sans étape manuelle.
- **Service** `app/services/supplier_product_service.ts` : `create`/`update`/`delete`,
  slug unique (`stringHelpers.slug` + suffixe), traductions par locale
  (`ProductTranslation.updateOrCreate`), facettes en ET fiable
  (`attributeValues.sync` avec `attribute_id`), et galerie (upload via
  `CloudinaryService.uploadMany`, suppression via `destroyMany`, `image_url` recalé
  sur la 1re image). `CloudinaryService` est **injecté** (tests avec faux uploader,
  aucun appel réseau).
- **Validation** : `app/validators/supplier_product.ts` (`vine.create`) — contenu
  bilingue requis (`translations.{fr,en}`), facettes (`attributeValueIds`), fichiers
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8), `removedImageIds` (édition).
- **Frontend** : pages `inertia/pages/supplier/products/{index,create,edit}.vue` (fines)
  - formulaire partagé `inertia/components/products/form/product_form.vue` découpé en
    sections (`translations`, `details`, `facets`, `images`) reliées par **provide/inject**
    du `useForm` ; nouveau champ générique `inertia/components/base_file_input.vue`.
    Soumission multipart via `form.transform(...).post(urlFor(...), { forceFormData: true })`.
- **i18n** : clés `products.manage.*` (`resources/lang/{fr,en}/products.json`).

> L'écran d'upload s'appuie sur l'infra Cloudinary (voir « Images produit » ci-dessus).

## i18n du contenu (FR par défaut, EN, extensible à N langues)

Tout le texte visible (nom, description, label) vit dans des **tables de
traduction dédiées** — jamais dans les tables de base :

- `supplier_translations`, `category_translations`, `attribute_translations`,
  `attribute_value_translations`, `product_translations` — colonnes
  `<entity>_id` + `locale` + champs traduits, unique `(<entity>_id, locale)`.
- Les tables de base ne gardent que le neutre : ids, slugs, `value`
  canonique, `unit`, `synonyms`, prix, flags, `embedding`. Migration
  `…960_drop_catalogue_translated_columns` retire les anciennes colonnes
  texte (réversible best-effort).
- **Modèles** : `*_translation.ts` (`belongsTo` du parent) + relation
  `@hasMany(() => XxxTranslation) translations` sur les 5 modèles de base.
- **Résolution localisée** : `shared/helpers/translations.ts` —
  `resolveTranslation(translations, locale, fallback = 'fr')` cherche la
  locale demandée, retombe sur `fr`, puis sur la première ligne disponible.
- **Transformers** locale-aware : constructeur `(resource, locale)`,
  `Xxx.transform(resource, ctx.i18n.locale)` sort `name`/`description`/
  `label` déjà résolus.
- **Types partagés** : `XxxTranslationType` par domaine ; `CreateXxxData`
  attend `translations: Partial<Record<Locale, {…}>>` plutôt que des champs
  texte à plat (voir `shared/types/product.ts`).
- **Seeders** : contenu de démo bilingue FR/EN pour les 5 domaines.

> Les validateurs `create`/`update` et les endpoints d'écriture ne sont pas
> encore adaptés au payload `translations` (prévu incrément suivant).

## Fichiers clés

| Domaine               | Chemin                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Modèles               | `app/models/{supplier,category,attribute,attribute_value,product,product_attribute}.ts` + `*_translation.ts` |
| Transformers          | `app/transformers/*_transformer.ts`                                                                          |
| Validators            | `app/validators/{supplier,category,attribute,product}.ts`                                                    |
| Types partagés        | `shared/types/{supplier,category,attribute,product}.ts`                                                      |
| Helper traduction     | `shared/helpers/translations.ts`                                                                             |
| Config FTS par locale | `shared/types/i18n.ts` (`LOCALE_TSCONFIG`)                                                                   |
| Règles de schéma      | `database/schema_rules.ts`                                                                                   |
| Seeders               | `database/seeders/{supplier,category,attribute,product}_seeder.ts`                                           |

## Tests

- `tests/functional/catalogue.spec.ts` — sanity du seed, transformers
  localisés, filtrage `ET` via relations réelles.
- `tests/functional/catalogue_fts.spec.ts` — FTS par langue
  (`to_tsquery('english', …)` vs `to_tsquery('french', …)`), présence/absence
  de `products.embedding`.
- `tests/unit/translations.spec.ts` — `resolveTranslation` (résolution +
  repli).
- Ces tests s'exécutent uniquement sous PostgreSQL (`tests/utils/database.ts`
  → `isPostgres()`) ; **sautés** sur SQLite (aucune migration catalogue
  lancée en local par défaut). Voir `docs/tests.md`.

## Roadmap

1. **Incrément 2** (fait) — i18n du contenu catalogue + FTS par langue.
2. **Incrément 3** (partiel) — catalogue public : moteur de recherche FTS
   locale-aware + filtrage à facettes en ET fiable (voir « Catalogue public »).
   Restent à faire : embeddings Mistral (`mistral-embed`, recherche sémantique),
   parseur de requête (synonymes), validateurs et endpoints d'écriture adaptés au
   payload `translations` (CRUD fournisseur).
