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
  (`vector_cosine_ops`). Peuplé par `mistral-embed` via
  `GenerateProductEmbeddingJob` (voir section dédiée ci-dessous).
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

## Embeddings Mistral & recherche hybride

- **`ProductEmbeddingService`** (`app/services/product_embedding_service.ts`)
  — appelle `mistral-embed` (`@mistralai/mistralai`, clé `MISTRAL_API_KEY`) et
  renvoie le vecteur 1024 dims. Client Mistral injectable au constructeur
  (tests sans appel réseau) ; lève `EmbeddingGenerationError`
  (`app/exceptions/embedding_errors.ts`) si la clé manque ou si la réponse
  Mistral ne contient pas de vecteur exploitable.
- **`GenerateProductEmbeddingJob`** (`app/jobs/generate_product_embedding_job.ts`,
  queue `@adonisjs/queue`) — charge le produit + ses traductions, embed le
  texte de la locale par défaut (repli sur la première traduction
  disponible via `resolveTranslation`), écrit `products.embedding` en SQL
  brut (`UPDATE … SET embedding = ?::vector`, colonne exclue du schéma ORM).
- **Déclenchement automatique** : hook `@afterSave` sur `ProductTranslation`
  émet l'événement `ProductContentUpdated` (`app/events/`), écouté par
  `OnProductContentUpdated` (`app/listeners/`) qui dispatch le job — toute
  création/mise à jour de traduction (donc de contenu produit) reprogramme
  la génération d'embedding, sans bloquer la requête (job mis en file, pas
  exécuté en synchrone).
- **Backfill** : commande ace `catalogue:backfill-embeddings`
  (`commands/backfill_product_embeddings.ts`) — liste les produits avec
  `embedding IS NULL` et dispatch un job par produit.
- **`ProductCatalogueService.search(query, locale, limit)`**
  (`app/services/product_catalogue_service.ts`) — recherche hybride :
  fusionne le classement full-text (`product_translations.search_vector`,
  `plainto_tsquery` par `LOCALE_TSCONFIG`) et le classement par similarité
  cosinus de l'embedding de la requête (`products.embedding <=> …`, index
  HNSW) via **Reciprocal Rank Fusion** (`score = Σ 1/(60 + rang)`) — combine
  deux classements sans normaliser deux échelles de score incomparables
  (`ts_rank` vs distance cosinus). Fonctionne même si `embedding` est encore
  `NULL` (dégrade en FTS pur) : voir
  `tests/functional/product_catalogue_search.spec.ts`. Pas encore consommé
  par un contrôleur/route (prévu avec la page catalogue Inertia).

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

| Domaine                | Chemin                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modèles                | `app/models/{supplier,category,attribute,attribute_value,product,product_attribute}.ts` + `*_translation.ts`                                                                                                                                             |
| Transformers           | `app/transformers/*_transformer.ts`                                                                                                                                                                                                                      |
| Validators             | `app/validators/{supplier,category,attribute,product}.ts`                                                                                                                                                                                                |
| Types partagés         | `shared/types/{supplier,category,attribute,product,search}.ts`                                                                                                                                                                                           |
| Helper traduction      | `shared/helpers/translations.ts`                                                                                                                                                                                                                         |
| Config FTS par locale  | `shared/types/i18n.ts` (`LOCALE_TSCONFIG`)                                                                                                                                                                                                               |
| Règles de schéma       | `database/schema_rules.ts`                                                                                                                                                                                                                               |
| Seeders                | `database/seeders/{supplier,category,attribute,product}_seeder.ts`                                                                                                                                                                                       |
| Embeddings & recherche | `app/services/{product_embedding_service,product_catalogue_service}.ts`, `app/jobs/generate_product_embedding_job.ts`, `app/events/product_content_updated.ts`, `app/listeners/on_product_content_updated.ts`, `commands/backfill_product_embeddings.ts` |

## Tests

- `tests/functional/catalogue.spec.ts` — sanity du seed, transformers
  localisés, filtrage `ET` via relations réelles.
- `tests/functional/catalogue_fts.spec.ts` — FTS par langue
  (`to_tsquery('english', …)` vs `to_tsquery('french', …)`), présence/absence
  de `products.embedding`.
- `tests/unit/translations.spec.ts` — `resolveTranslation` (résolution +
  repli).
- `tests/unit/product_embedding_service.spec.ts` — appel Mistral mocké,
  erreur si réponse sans vecteur.
- `tests/functional/generate_product_embedding_job.spec.ts` — `execute()`
  peuple `products.embedding` (service injecté, zéro appel réseau),
  tolérance produit introuvable, déclenchement du job via `queue.fake()` à
  la sauvegarde d'une traduction.
- `tests/functional/product_catalogue_search.spec.ts` — recherche hybride :
  match lexical pur, match sémantique pur (embedding identique à la requête,
  aucun recouvrement de texte).
- `tests/functional/backfill_product_embeddings.spec.ts` — la commande met
  en file un job par produit sans embedding.
- Ces tests s'exécutent uniquement sous PostgreSQL (`tests/utils/database.ts`
  → `isPostgres()`) ; **sautés** sur SQLite (aucune migration catalogue
  lancée en local par défaut). Voir `docs/tests.md`.

## Roadmap

1. **Incrément 2** (fait) — i18n du contenu catalogue + FTS par langue.
2. **Incrément 3** (fait) — embeddings Mistral (`mistral-embed`), job +
   déclenchement événementiel, backfill, recherche hybride FTS/vectorielle
   (`ProductCatalogueService`).
3. **Incrément 4** — parseur de requête (synonymes, facettes), validateurs
   et endpoints d'écriture adaptés au payload `translations`, page catalogue
   Inertia consommant `ProductCatalogueService.search`.
