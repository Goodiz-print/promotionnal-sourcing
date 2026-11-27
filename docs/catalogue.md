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

## Attributs filtrables par catégorie (ÉTAPE 1 du modèle produit)

Fondations pour des filtres **qui changent selon la catégorie** (écarts 1 et 6 du
plan d'extension), alignées sur les classeurs Virgile (PromoStandards / Midocean).

- **`category_attributes`** — pivot catégorie ↔ attribut : `category_id`,
  `attribute_id`, `is_required_for_publication`, `is_filter`, `position`,
  `unique(category_id, attribute_id)`. Déclare quels attributs sont pertinents
  pour une catégorie, lesquels sont obligatoires pour publier, lesquels servent de
  filtre, et dans quel ordre.
- **`category_attribute_ranges`** — tranches d'un attribut numérique (table
  enfant, pas de JSONB) : `min_value` / `max_value` (nullable = borne ouverte),
  `position`. **Le libellé n'est pas stocké** (rendu côté UI depuis les bornes +
  l'unité + la locale).
- **`attribute_values.hex` / `parent_value_id`** — couleur à 2 niveaux : une
  nuance (N2) pointe vers sa famille (N1) via `parent_value_id` (self-FK,
  `SET NULL`) ; `hex` porte la pastille. Deux attributs : `color` (14 familles) et
  `color-shade` (26 nuances).

**Résolution** — `CatalogueFacetsService` (`app/services/catalogue_facets_service.ts`,
injecté) : l'ensemble d'attributs d'une catégorie est la réunion de ses attributs
**propres et de ceux de tous ses ancêtres** (remontée `parent_id` jusqu'à la
racine) ; un attribut peut donc être rattaché à n'importe quel niveau (N2 ou N3).
`resolveForCategory` trie par `position` et résout valeurs + tranches ;
`resolveFilters` ne garde que `is_filter = true`.

**Garde de publication** — `assertPublishable` / `missingRequiredAttributes`
lèvent `ProductPublicationBlockedException` (`app/exceptions/catalogue_errors.ts`)
tant qu'un attribut `is_required_for_publication` de la catégorie ou d'un ancêtre
n'est pas renseigné sur la fiche.

**Facettes de recherche** — les valeurs de ces attributs entrent dans
`attributeValueIds` de l'index : le ET multi-critères (dont couleur N1/N2)
fonctionne tel quel, backfill par `search:reindex`. L'index porte en plus des
facettes **aplaties par slug** (`attributes.<slug>`) pour exposer les
**distributions** (compteurs par valeur) et piloter la barre de filtres
dépendante de la catégorie (`CatalogueFacetBarService`) — voir `docs/search.md`.

**Seeders** — arbre N1 > N2 (15 / 45) + synonymes, couleurs (familles + nuances),
matières, et un jeu curé d'attributs par catégorie, depuis
`database/data/catalogue/*`. Certifications et techniques de marquage arrivent
dans des étapes ultérieures.

## Extensions PostgreSQL et colonnes de recherche retirées

Migration `…948_enable_search_extensions` active `vector` (pgvector),
`pg_trgm` et `unaccent` — no-op hors PostgreSQL. Ces extensions restent
installées (les anciennes migrations les créent) mais **plus aucune table ne s'en
sert** depuis la migration `…drop_postgres_search_columns` (#112, PR 3), qui a
retiré :

- `products.embedding` (`halfvec(1024)`) et son index HNSW `products_embedding_idx`
  — Meilisearch calcule et garde les vecteurs (ADR 0002) ;
- `products.embedding_key` ;
- `product_translations.search_vector` (`tsvector`) et ses index GIN par locale,
  ainsi que `ProductTranslationSearchService` (et la table de configurations
  `LOCALE_TSCONFIG`, supprimée du code).

Ajouter une langue de contenu ne demande donc plus ni index ni migration : il suffit
de l'ajouter à `TRANSLATION_LOCALES` (`shared/types/i18n.ts`, dont `CONTENT_LOCALES` est
le miroir) ; l'index Meilisearch porte
les noms et descriptions de toutes les langues sous des sous-clés. `down()` recrée
les colonnes vides (vecteurs : `search:reindex` ; tsvector : réécrire la traduction).

## Recherche sémantique (embedder de Meilisearch)

En complément du mot-clé, la recherche est **sémantique** : des produits pertinents
remontent même sans mot-clé exact (« stylo écologique » → produits verts), et dans
une autre langue que celle de la fiche. **Meilisearch calcule lui-même les vecteurs**
(modèle local `huggingFace` par défaut, ou API d'embeddings) : l'application n'a plus de job,
de service, de commande ni de cache d'embeddings. Décision et compromis :
[ADR 0002](adr/0002-recherche-meilisearch-hybride.md) ; fonctionnement :
[`search.md`](search.md).

- **Texte vectorisé** — `ProductIndexService.embeddingText` : nom dans la langue
  source, catégorie, facettes « attribut : valeur », début de description (300
  caractères). Poussé dans chaque document (`embeddingText`), lu par le
  `documentTemplate` de l'embedder.
- **Activation** — `config/search.ts` (`embedder`). **Active par défaut** : le
  provider par défaut, `huggingface`, fait tourner un modèle multilingue
  open-weight (`intfloat/multilingual-e5-base`) **dans Meilisearch, sans clé ni
  coût par token**. `AI_PROVIDER=mistral` (avec `MISTRAL_API_KEY`) ou
  `openai-compatible` (`AI_API_KEY` / `AI_BASE_URL`) appellent à la place une API
  d'embeddings. `AI_EMBEDDINGS_ENABLED=false` la coupe (mots-clés seuls) ; `=true`
  avec un provider API sans identifiants est une **erreur au démarrage** ; en
  `NODE_ENV=test`, elle est coupée sauf demande explicite.
- **Colonnes PostgreSQL** — `products.embedding`, `products.embedding_key` et l'index
  HNSW ont été supprimés (migration `…drop_postgres_search_columns`) : les vecteurs
  n'existent que dans l'index.

### Activer la vectorisation (production)

La vectorisation est active par défaut ; il n'y a **aucune clé à définir** avec le
provider `huggingface`.

1. S'assurer que l'instance Meilisearch peut joindre Hugging Face en sortie (le
   modèle, ~1 Go, est téléchargé au premier usage) et qu'elle a assez de RAM / CPU
   (voir `docs/deploiement.md`).
2. Redéployer, puis `node ace search:reindex` : l'index est reconstruit avec
   l'embedder et Meilisearch vectorise tout le catalogue. La première tâche est
   longue (téléchargement du modèle, calcul sur CPU).
3. Ensuite, chaque création ou mise à jour de produit resynchronise son document ;
   Meilisearch ne recalcule le vecteur que si le texte vectorisé change.
4. Mesurer : `node ace search:evaluate` (les requêtes sémantiques cessent d'être
   ignorées) — cf. `docs/search.md`.

Pour utiliser l'API Mistral à la place : `AI_PROVIDER=mistral` et
`MISTRAL_API_KEY` sur web et worker, puis `node ace search:reindex`. Pour couper la
vectorisation : `AI_EMBEDDINGS_ENABLED=false`, puis `node ace search:reindex`
(retire l'embedder et ses vecteurs).

## Catalogue public (lecture)

Écran acheteur public (sans auth), sous le préfixe de locale (`/fr`, `/en`) :

- **Routes** : `GET /products` (`products.index`, liste filtrée/paginée) et
  `GET /products/:slug` (`products.show`, fiche). Produit inactif/inconnu → 404
  (`ProductNotFoundException`, `app/exceptions/catalogue_errors.ts`).
- **Service** : `app/services/product_catalogue_service.ts` — toute la logique ORM
  (controller fin `products_controller.ts`). `PER_PAGE = 12`.
- **Recherche par terme** : `ProductSearchService` (Meilisearch, [`search.md`](search.md)) ;
  `ProductCatalogueService#list` ne sert plus que la navigation **sans terme**
  (catégories, filtres, tri par prix). Moteur indisponible : la page affiche
  « recherche indisponible » (prop `searchUnavailable`) au lieu d'un faux « aucun résultat ».
- **Filtres** : catégorie (`categoryId`), made-in-Europe (`madeInEurope`), et
  **facettes attributs** (`attributeValueIds[]`) en **ET fiable** — un `whereHas`
  par valeur sélectionnée, cf. la section « ET » ci-dessus.
- **Facettes exposées à l'UI** : `availableCategories()` (catégories ayant au moins
  un produit actif) + **barre de filtres dépendante de la catégorie** (prop `facetBar`,
  `CatalogueFacetBarService`) : les attributs filtrables résolus de la catégorie
  sélectionnée (propres + hérités) avec leurs compteurs. Sans catégorie, la barre
  d'attributs est vide.
- **Frontend** : `inertia/pages/products/{index,show}.vue`, barre de filtres
  `inertia/components/catalogue_filters.vue` + `inertia/components/catalogue/facet_group.vue`
  (pastille hex des couleurs, compteurs par valeur, tranches numériques ; générique
  `base_checkbox.vue`), cartes `product_card.vue`. i18n : `resources/lang/{fr,en}/products.json`.

> Hors périmètre de cette tranche : CRUD fournisseur (dépend de l'auth fournisseur),
> recherche sémantique par embeddings, ranking `ts_rank`, tolérance typo `pg_trgm`
> (désormais portés par Meilisearch, ADR 0002).

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
  `resolveTranslation(translations, locale, { sourceLocale?, fallback = 'fr' })` cherche la
  locale demandée, retombe sur la **langue source** de l'entité, puis sur `en`, puis
  `fr`, puis sur la première locale par ordre alphabétique (déterministe).
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
  par `TranslateEntityJob` à la sauvegarde (Mistral par défaut, ou Claude avec
  `AI_LLM_PROVIDER=claude`, ADR 0006).
- Chaque ligne de traduction porte `is_auto` : `true` = générée (corrigeable),
  `false` = saisie ou corrigée à la main. `TranslationService` n'écrase jamais
  une ligne `is_auto = false`. Renvoyer une traduction inchangée ne change pas son
  marquage.
- **Validateurs séparés** (`app/validators/supplier_product.ts`, `category.ts`) :
  `create` exige `sourceLocale` et la seule traduction de cette langue ; `update`
  est partiel (un champ absent n'est pas modifié, facettes conservées si
  `attributeValueIds` est absent, une seule langue peut être corrigée).
- Attributs et valeurs d'attributs : `AttributeService` (#48) met la traduction en
  file à chaque création ou modification (`TranslationQueueService`) ; les noms et
  libellés saisis à la main passent en `is_auto = false` et ne sont jamais écrasés.
- **32 langues actives (#97)** : `CONTENT_LOCALES` couvre les 32 langues de
  `TRANSLATION_LOCALES`. La saisie (validateurs, formulaires produit et catégorie)
  accepte n'importe laquelle comme langue source ; le formulaire affiche la langue
  source plus une autre langue au choix. La recherche reste multilingue sur toutes
  les sous-clés `names.*` / `descriptions.*` (ADR 0002), sans locale dans la requête.
- **Rattrapage** : `node ace translation:backfill [--limit=N] [--entity=product]`
  met en file la traduction des contenus existants (produits actifs, catégories,
  attributs, valeurs). Idempotent : une langue déjà à jour ne rappelle pas le fournisseur IA.
  `--limit` sert à mesurer le coût réel sur un échantillon avant un passage en masse.
  Un appel par entité couvre les 31 langues cibles (`maxTokens` plafonné,
  réponse tronquée rejetée puis rejouée par le job). Changer de fournisseur ou de
  modèle change la clé d'idempotence : le contenu automatique est retraduit.

## Administration de la taxonomie (catégories globales)

CRUD des catégories sous `/:locale/admin/categories` (`admin.categories.*`). Les catégories sont une ressource **globale** de la plateforme : l'accès est réservé aux **admins plateforme** (`users.platform_role = 'admin'`, middleware `platformAdmin` + ability `canManageCategories`), quel que soit — ou même en l'absence de — rôle d'organisation. Avant #47, le `owner`/`admin` de n'importe quelle organisation pouvait modifier la taxonomie ; c'est corrigé. Voir `docs/organisations.md` (§ Rôles : organisation vs plateforme) pour l'attribution du rôle et le reste du back-office.

## Administration des attributs et valeurs (facettes, #48)

Les facettes (couleur, matière, grammage…) s'administrent sous `/:locale/admin/attributes`, sans passer par un seeder ni un déploiement. Comme les catégories, elles sont **globales** : accès réservé aux admins plateforme (middleware `platformAdmin` + ability `canManageAttributes`). Onglet « Attributs » du back-office.

| Route                                                                              | Action                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET admin/attributes` (`admin.attributes.index`)                                  | liste : nom, type, unité, filtrable, nombre de valeurs et de produits |
| `GET admin/attributes/new`, `POST admin/attributes` (`.create`, `.store`)          | création, puis redirection vers l'édition                             |
| `GET admin/attributes/:id/edit`, `PATCH admin/attributes/:id` (`.edit`, `.update`) | édition (nom par langue, unité, filtrable) et valeurs en ligne        |
| `DELETE admin/attributes/:id` (`.destroy`)                                         | suppression                                                           |
| `POST admin/attributes/:id/values` (`admin.attribute_values.store`)                | ajout d'une valeur                                                    |
| `PATCH` / `DELETE admin/attributes/:id/values/:valueId` (`.update`, `.destroy`)    | libellé, synonymes, suppression                                       |

- **Service** : `AttributeService` (`app/services/attribute_service.ts`). Création et mise à jour dans une transaction ; langue source obligatoire (comme les catégories) ; les autres langues sont générées (#75).
- **Champs figés** : `slug` et `type` d'un attribut, `slug` d'une valeur (la valeur canonique `value` reprend le slug à la création). Les produits, les filtres et les URLs s'appuient dessus.
- **Suppression refusée** (`AttributeInUseException`, `AttributeValueInUseException` dans `catalogue_errors.ts`) : attribut renseigné par des produits (`product_attributes`) ou retenu par une catégorie (`category_attributes`) ; valeur portée par des produits ou famille de couleur qui a encore des nuances (`parent_value_id`). Message flash, aucune donnée supprimée.
- **Valeurs** : éditées en ligne dans `edit.vue` pour les attributs de type `enum` ; l'écran n'édite que le libellé de la langue source et les synonymes (la pastille `hex` et le rattachement `parent_value_id` des couleurs restent gérés par le seeder).
- **Validateurs** (`app/validators/attribute.ts`) : payload `translations` par langue de contenu, comme les catégories. Plus de champ `name` / `label` à plat.
- **Index de recherche** : renommer une facette ou une valeur ne réindexe pas les produits automatiquement ; `node ace search:reindex` rafraîchit l'embedding et les documents.

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

| Domaine            | Chemin                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Modèles            | `app/models/{supplier,category,attribute,attribute_value,product,product_attribute}.ts` + `*_translation.ts` |
| Transformers       | `app/transformers/*_transformer.ts`                                                                          |
| Validators         | `app/validators/{supplier,category,attribute,product}.ts`                                                    |
| Types partagés     | `shared/types/{supplier,category,attribute,product}.ts`                                                      |
| Helper traduction  | `shared/helpers/translations.ts`                                                                             |
| Langues de contenu | `shared/types/i18n.ts` (`CONTENT_LOCALES`)                                                                   |
| Règles de schéma   | `database/schema_rules.ts`                                                                                   |
| Seeders            | `database/seeders/{supplier,category,attribute,product}_seeder.ts`                                           |

## Tests

- `tests/functional/catalogue.spec.ts` — sanity du seed, transformers
  localisés, filtrage `ET` via relations réelles.
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
