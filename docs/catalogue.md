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

- **`products.embedding`** — `halfvec(1024)`, nullable, index **HNSW**
  (`halfvec_cosine_ops`, voir « Décision halfvec »). Les requêtes castent en `?::halfvec`. Peuplé par le job `generate_product_embedding_job`
  (`mistral-embed`) — voir « Recherche sémantique » ci-dessous.
- **`product_translations.search_vector`** — colonne `tsvector` **ordinaire**,
  calculée par l'application à l'écriture d'une traduction
  (`ProductTranslationSearchService.refreshForProduct`, config lue dans
  `LOCALE_TSCONFIG`, repli `'simple'`) + un index GIN **partiel par locale**
  (`WHERE locale = '<xx>'`). `unaccent()` reste appliqué côté requête.
- Toute écriture de `product_translations` doit appeler le service (un test
  vérifie qu'aucune ligne n'a un `search_vector` NULL).
- Ajouter une langue à la recherche plein-texte = une entrée dans
  `LOCALE_TSCONFIG` (`shared/types/i18n.ts`), une migration
  `CREATE INDEX … WHERE locale = '<xx>'` et le backfill de ses lignes. Aucune
  réécriture de la table (#84).

`database/schema_rules.ts` exclut `products.embedding` et
`product_translations.search_vector` du schéma généré par l'ORM (colonnes
SQL brutes, jamais typées/sérialisées).

## Décision halfvec (#71)

**Décision : `halfvec(1024)`** (migration `…300000_products_embedding_halfvec`, à jouer avant le remplissage en masse).

Mesures locales (pgvector 0.8.5, 20 000 vecteurs 1024 dim synthétiques) :

|                               | `vector`   | `halfvec`  |
| ----------------------------- | ---------- | ---------- |
| Octets par embedding          | 4 100      | 2 052      |
| Table (+TOAST)                | 107 Mo     | 54 Mo      |
| Index HNSW                    | 156 Mo     | 52 Mo      |
| Latence requête top-10 (moy.) | 3,2–4,8 ms | 2,2–2,5 ms |

Soit ~1 Go d'index et ~2 Go de table économisés pour 1 M de produits.
Précision : écart de distance cosinus halfvec vs vector ≤ 1,6·10⁻⁵ (moy. 3,6·10⁻⁶), contre un écart-type des distances de ~5·10⁻³ au sein d'un cluster ; le classement ne change que pour des quasi-égalités.

Limites : le jeu synthétique (bruit uniforme) est quasi-équidistant, donc un rappel@10 par identifiants n'y est pas significatif (même `vector`+HNSW n'atteint que ~52 %) ; le temps de build de l'index (62 s vs 12 s) est biaisé par `maintenance_work_mem` trop faible pour `vector`. À revalider sur de vrais embeddings `mistral-embed` quand le catalogue sera rempli ; retour arrière possible via le `down()` de la migration.

## Recherche sémantique (embeddings Mistral)

En complément du full-text (correspondance lexicale), le catalogue offre une
**recherche sémantique** : des produits pertinents remontent même sans mot-clé
exact (« stylo écologique » → produits verts).

- **Provider-agnostique** — `AI_PROVIDER` choisit le driver d'embeddings :
  `mistral` (SDK natif) ou `openai-compatible` (driver générique HTTP parlant le
  protocole OpenAI `/embeddings` : OpenAI, Together, Groq, Ollama, vLLM, LM
  Studio… via `AI_BASE_URL` / `AI_API_KEY` / `AI_EMBED_MODEL`). Chaque driver
  étend la classe abstraite `EmbeddingProvider` (token d'injection) ; le
  **service provider** `providers/ai_provider.ts` lie ce token au driver choisi
  (`container.singleton`), résolu par le **conteneur IoC** puis injecté dans
  `EmbeddingService`. Ajouter un provider = un fichier dans
  `app/services/embeddings/` + un `case` dans `provider_registry.ts`.
- **Config** `config/ai.ts`. La vectorisation est **active par défaut dès que le
  provider est configuré** : renseigner `MISTRAL_API_KEY` (ou `AI_API_KEY` /
  `AI_BASE_URL` pour `openai-compatible`) suffit. Sans identifiants, elle reste
  coupée (dev local, CI) et aucun appel réseau n'a lieu ; en `NODE_ENV=test`, elle
  est coupée sauf demande explicite. `AI_EMBEDDINGS_ENABLED=false` la coupe même
  avec une clé ; `=true` sans identifiants est une **erreur au démarrage**. La
  **dimension est figée à 1024** (colonne `products.embedding`) : chaque provider
  est configuré pour réduire à 1024 (`outputDimension` Mistral, `dimensions`
  OpenAI) ; un vecteur d'une autre taille lève `EmbeddingDimensionError`.
- **Génération** — `EmbeddingService` (provider injecté, testable) calcule
  l'embedding depuis `productText` (nom + description, toutes locales) et l'écrit
  en `products.embedding` (`?::halfvec`). Déclenchée en asynchrone par le job
  `generate_product_embedding_job`, dispatché à la création/mise à jour d'un
  produit (`supplier_product_service`, dispatch résilient — un échec queue ne
  casse jamais l'écriture produit).
- **Requête** — `products_controller` calcule (best-effort) l'embedding du terme
  recherché quand l'IA est active ; `product_catalogue_service.list` trie alors
  par distance cosinus (`embedding <=> ?::halfvec`, index HNSW) parmi les produits
  vectorisés. **Repli automatique** sur le full-text si l'IA est indisponible ou
  la requête non vectorisée.
- **Backfill** — `node ace embeddings:backfill` génère les embeddings manquants
  (produits importés en masse, activation initiale), par lots de 200 ; `--all`
  repasse tout le catalogue (seuls les produits dont la clé d'idempotence a
  changé rappellent l'API — à faire après un changement de modèle). Chaque
  vecteur écrit déclenche la synchronisation de l'index Meilisearch.

### Activer la vectorisation (production)

1. Définir `MISTRAL_API_KEY` sur les applications **web et worker** (variables
   d'environnement Clever Cloud) ; `AI_EMBEDDINGS_ENABLED` n'a pas à être défini.
2. Redéployer : les créations et mises à jour de produits déclenchent alors le
   calcul de leur vecteur (`GenerateProductEmbeddingJob`).
3. Vectoriser l'existant : `node ace embeddings:backfill`. Coût indicatif :
   ~0,10 $ par million de tokens, soit une vingtaine de dollars pour 1 M de fiches
   (à confirmer sur la grille du fournisseur).
4. Si la recherche passe par Meilisearch, les vecteurs y arrivent au fil du
   backfill ; `node ace search:reindex` rattrape l'index en une passe (sans
   rappel d'API : les vecteurs sont en base).
5. Mesurer : `node ace search:evaluate` (les requêtes sémantiques cessent d'être
   ignorées) — cf. `docs/search.md`.

Pour couper la vectorisation sans retirer la clé : `AI_EMBEDDINGS_ENABLED=false`.

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

## Images produit (galerie + Cellar)

Un produit porte une **galerie** d'images ordonnées, hébergées sur Cellar (voir [`storage.md`](storage.md)).

- **Stockage** : table `product_images` (one-to-many) — `product_id` (CASCADE),
  `secure_url`, `storage_object_id` (FK `storage_objects`, nullable pour l'historique), `position`
  (ordre, unique par produit), `width`/`height`. Modèle `app/models/product_image.ts`
  (`Product hasMany images`). URL/position **neutres** (pas de localisation) ; des
  alt/légendes localisés suivraient le précédent `product_translations` (hors v1).
- **`products.image_url`** : conservé comme **image principale dénormalisée**
  (repli affichage + cartes catalogue) ; la galerie complète vit dans `product_images`.
- **Upload** : `app/services/storage/storage_service.ts` (`store`/`storeMany`/`release`),
  clé déterministe `promotionnal-sourcing/<environnement>/<sha256>.<ext>` ; validateur
  multi-fichiers réutilisable `app/validators/product_image.ts`
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8). Le service et le
  validateur sont prêts ; **l'écran d'upload fournisseur** sera branché avec le CRUD
  produit fournisseur.
- **Affichage** : `ProductDetailTransformer` expose `images` (triées par `position`) ;
  fiche `inertia/pages/products/show.vue` via `inertia/components/product_gallery.vue`
  (image principale + miniatures, repli sur `imageUrl`). L'image principale sert la
  variante `detail` et les miniatures la variante `card` quand elles existent,
  sinon l'original (voir « Variantes d'image » dans [`storage.md`](storage.md)).

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
  `StorageService.storeMany`, retrait via `release` dans la transaction, `image_url`
  recalé sur la 1re image). `StorageService` est **injecté** (tests avec
  `container.swap(StorageDriver, fake)`, aucun appel réseau).
- **Validation** : `app/validators/supplier_product.ts` (`vine.create`) — contenu
  bilingue requis (`translations.{fr,en}`), facettes (`attributeValueIds`), fichiers
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8), `removedImageIds` (édition).
- **Frontend** : pages `inertia/pages/supplier/products/{index,create,edit}.vue` (fines)
  - formulaire partagé `inertia/components/products/form/product_form.vue` découpé en
    sections (`translations`, `details`, `facets`, `images`) reliées par **provide/inject**
    du `useForm` ; nouveau champ générique `inertia/components/base/base_file_input.vue`.
    Soumission multipart via `form.transform(...).post(urlFor(...), { forceFormData: true })`.
- **i18n** : clés `products.manage.*` (`resources/lang/{fr,en}/products.json`).

> L'écran d'upload s'appuie sur l'infra de stockage Cellar (voir « Images produit » ci-dessus).

## Variantes et paliers de prix (#53)

Un objet publicitaire se décline (couleur, taille, marquage) et son prix dépend
de la quantité commandée.

- **`product_variants`** : `product_id` (CASCADE), `sku` (unique par produit),
  `image_id` → `product_images` (SET NULL, image affichée quand la variante est
  choisie), `is_active`. Pivot **`product_variant_attributes`** : une valeur
  d'attribut par attribut et par variante (couleur = rouge, taille = L).
- **`product_price_tiers`** : `product_id`, `variant_id` (NULL = palier du
  produit, sinon palier propre à la variante), `min_quantity`,
  `unit_price decimal(12,4)`, `currency`. Unicité `(product_id, variant_id,
min_quantity)` en `NULLS NOT DISTINCT` (PostgreSQL ≥ 15) : deux paliers
  produit de même quantité sont aussi refusés.
- **`products.price_min` / `price_max` sont recalculés** depuis les paliers
  (min / max de `unit_price`) à chaque synchronisation — dénormalisation pour
  les cartes et le tri. Sans palier, la saisie manuelle est conservée. Colonnes
  en `decimal(12,2)` : un prix à 4 décimales y est arrondi.
- **Écriture** (`ProductVariantService`, appelé par `SupplierProductService`
  **dans la transaction du produit**) : champs `variants[]` et `priceTiers[]` du
  payload de création/mise à jour. `undefined` = inchangé ; un tableau (même
  vide) remplace l'ensemble. Variantes rapprochées par SKU (id conservé) ;
  paliers réécrits, `variantSku` désigne la variante visée. SKU en double,
  palier dupliqué, SKU inconnu, image hors galerie ou deux valeurs du même
  attribut → erreur de validation (422) et rien n'est écrit.
- **Lecture** : la fiche publique (`ProductDetailTransformer`) expose les
  variantes **actives** (facettes résolues) et la grille de prix ; le sélecteur
  de variante change l'image de la galerie et affiche la grille de la variante
  si elle a ses propres paliers, sinon celle du produit.
- **Tri** : `GET /products?sort=price_asc` trie par prix unitaire du premier
  palier (plus petite quantité) ; produits sans palier en fin de liste.
- **Formulaire fournisseur** : sections `product_variants_fields.vue` et
  `product_price_tiers_fields.vue` (provide/inject `ProductFormKey`). Limite :
  Inertia omet les tableaux vides en multipart ; avec de nouvelles images dans
  la même soumission, supprimer _toutes_ les variantes/paliers demande donc un
  second enregistrement.
- Hors périmètre : colonnes variantes/paliers de l'import CSV (issue dédiée),
  contrôle de tri dans l'UI du catalogue.

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

### Politique de traduction (source + auto)

- Le fournisseur saisit nom/description dans sa **langue source**
  (`sourceLocale`, colonne `source_locale` sur `products`, `categories`,
  `attributes`, `attribute_values`). Les autres langues de contenu sont générées
  par `TranslateEntityJob` (Mistral) à la sauvegarde.
- Chaque ligne de traduction porte `is_auto` : `true` = générée (corrigeable),
  `false` = saisie ou corrigée à la main. `TranslationService` n'écrase jamais
  une ligne `is_auto = false`. Renvoyer une traduction inchangée ne change pas son
  marquage.
- **Validateurs séparés** (`app/validators/supplier_product.ts`, `category.ts`) :
  `create` exige `sourceLocale` et la seule traduction de cette langue ; `update`
  est partiel (un champ absent n'est pas modifié, facettes conservées si
  `attributeValueIds` est absent, une seule langue peut être corrigée).
- Attributs et valeurs d'attributs : colonnes et prise en charge par
  `TranslationService` en place ; le déclenchement sera branché avec leur futur
  écran d'écriture (aujourd'hui : seeders).
- Les 32 langues de #75 ne sont pas activées : `CONTENT_LOCALES` reste `fr`/`en`
  tant que l'index plein texte n'est pas étendu (#84).

## Administration de la taxonomie (catégories globales)

CRUD des catégories sous `/:locale/admin/categories` (`admin.categories.*`). Les catégories sont une ressource **globale** de la plateforme : l'accès est réservé aux **admins plateforme** (`users.platform_role = 'admin'`, middleware `platformAdmin` + ability `canManageCategories`), quel que soit — ou même en l'absence de — rôle d'organisation. Avant #47, le `owner`/`admin` de n'importe quelle organisation pouvait modifier la taxonomie ; c'est corrigé. Voir `docs/organisations.md` (§ Rôles : organisation vs plateforme) pour l'attribution du rôle et le reste du back-office.

## Fiche technique PDF (#60)

Un produit peut porter des **fiches techniques** PDF (compressées Ghostscript puis stockées sur Cellar,
cf. [`storage.md`](storage.md)).

- **Table** `product_documents` : `product_id` (CASCADE), `storage_object_id` (nullable, `SET NULL`),
  `original_name`, `size_bytes`. Modèle `ProductDocument` ; relation `Product hasMany documents`.
- **Routes** (droit `canManageProducts`, produit de l'organisation courante) :
  `POST /:locale/supplier/products/:id/documents` (`supplier.products.documents.store`, champ `file`) et
  `DELETE /:locale/supplier/products/:id/documents/:documentId` (`supplier.products.documents.destroy`).
- **Formulaire fournisseur** : sur `supplier/products/edit.vue`, sous le formulaire produit, un bloc
  « Fiche technique » (`document_manager.vue`, sans choix de nature). Il n'existe pas à la création : un
  `<form>` ne peut pas en contenir un autre et le téléversement exige un produit enregistré.
- **Fiche publique** : `ProductDetailType.documents` ; `products/show.vue` affiche la section « Fiche
  technique » (liens vers Cellar) si au moins un document existe. `ProductEditType.documents` alimente
  le formulaire d'édition.
- **Préchargement** : `findBySlug` (catalogue) et `findOwned` (fournisseur) chargent `documents` avec leur
  `storageObject`, en écartant les lignes sans fichier.
- **Tests** : `tests/functional/documents_routes.spec.ts`, `tests/functional/documents_pages.spec.ts`,
  `tests/inertia/documents.spec.ts`, `tests/inertia/products.spec.ts`.

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
- `tests/functional/product_variants.spec.ts` — variantes, paliers, recalcul
  de la fourchette de prix, unicité SKU/palier, tri par prix.
- `tests/inertia/product_variants.spec.ts` — sélecteur de variante, grille de prix.
- `tests/unit/translations.spec.ts` — `resolveTranslation` (résolution +
  repli).
- Comme toute la suite, ces tests s'exécutent sous PostgreSQL
  (`pnpm test:db && pnpm test`). Voir `docs/tests.md`.

## Roadmap

1. **Incrément 2** (fait) — i18n du contenu catalogue + FTS par langue.
2. **Incrément 3** (partiel) — catalogue public : moteur de recherche FTS
   locale-aware + filtrage à facettes en ET fiable (voir « Catalogue public »).
   Restent à faire : embeddings Mistral (`mistral-embed`, recherche sémantique),
   parseur de requête (synonymes), validateurs et endpoints d'écriture adaptés au
   payload `translations` (CRUD fournisseur).
