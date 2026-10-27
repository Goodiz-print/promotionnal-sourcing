# Plan d'extension du modèle produit — alignement sur la fiche type & les filtres

> Document de travail (Claude, 2026-10-25). Source : classeurs « Caractéristiques produit attendues » et « Filtres par catégorie » (v. 19 oct. 2026), confrontés au modèle existant.

## Contexte

Le modèle produit existe déjà et son **architecture colle à l'intention de la spec** : arbre de catégories récursif (`categories.parent_id`), système **EAV** (`attributes` / `attribute_values` / `product_attributes` / `product_variant_attributes`) avec `synonyms[]` (= le dictionnaire de libellés fournisseurs pour l'import), traductions i18n, variantes SKU, paliers de prix, galerie + variantes d'images, documents PDF, et l'indexation Meilisearch (embeddings calculés par l'app, PostgreSQL source de vérité).

La spec va un cran plus loin. Ce plan comble **9 écarts**, en **réutilisant l'EAV partout où c'est possible** et en n'ajoutant de tables dédiées que pour les sous-domaines hétérogènes (marquage, logistique) et les référentiels fermés (certifications, techniques).

## Principes directeurs

1. **Un attribut par (concept, catégorie) quand les valeurs diffèrent.** Le « Type » d'un stylo ≠ le « Type » d'un sac → deux attributs distincts (`type-stylo`, `type-sac`). Les valeurs possibles restent donc portées par l'attribut, sans scoping de valeurs par catégorie. Les attributs transverses (couleur, matière, grammage, contenance) sont **partagés** et rattachés à plusieurs catégories.
2. **EAV pour tout ce qui est facette filtrable** (caractéristiques physiques, attributs par catégorie, couleur, matière). Tables dédiées seulement pour : marquage, logistique, certifications (liste fermée à domaine), techniques de marquage (liste fermée).
3. **PostgreSQL reste la source de vérité** ; chaque nouveau champ filtrable est ajouté au mapping Meilisearch et déclenche une réindexation (cf. `docs/search.md`, ADR 0002).
4. **Conventions projet** : migrations avec `down()`, `database/schema.ts` régénéré par `migration:run` (ne pas éditer), modèles étendant `XxxSchema` + relations, types dans `shared/types/<domaine>.ts`, DI via `@inject` (jamais `new`), libellés de référentiels traduits (tables `*_translations`), factories pour les tests, et une entrée `docs/changelog/AAAA-MM-JJ-slug.md` par incrément livré.

---

## Écart 1 — Attributs & filtres **par catégorie** (chantier central)

C'est le « les filtres changent selon la catégorie » + le contrôle « xx produits ont des infos manquantes ». Aujourd'hui les attributs sont **globaux**.

**Nouvelle table pivot `category_attributes`** (catégorie ↔ attribut, config par couple) :

| Colonne                       | Type          | Rôle                                                     |
| ----------------------------- | ------------- | -------------------------------------------------------- |
| `category_id`                 | FK categories | —                                                        |
| `attribute_id`                | FK attributes | —                                                        |
| `is_required_for_publication` | bool          | colonne « Obligatoire pour publication »                 |
| `is_filter`                   | bool          | colonne « Sert de filtre » (par catégorie)               |
| `position`                    | int           | « Ordre » d'affichage du filtre                          |
| timestamps                    |               |                                                          |
|                               |               | `unique(category_id, attribute_id)`, index `category_id` |

**Tranches numériques — table enfant dédiée** (choix « le plus robuste », plutôt que du JSONB) **`category_attribute_ranges`** : `id, category_attribute_id (FK), min_value (decimal null), max_value (decimal null), position (int)`, timestamps. Le **libellé n'est pas stocké** : il est rendu côté UI depuis les bornes + l'unité de l'attribut + la locale (ex. `< 400 ml`, `400-600 ml`) — pas de chaîne figée à traduire, bornes requêtables et validables. Un intervalle ouvert = `min_value` ou `max_value` null.

- **Héritage** : un attribut peut être attaché à **n'importe quel niveau** (N2 ou N3) ; la résolution des attributs d'un produit remonte **toute la chaîne d'ancêtres** (`parent_id` jusqu'à la racine). Certaines N3 ajoutent leurs propres attributs en plus de ceux hérités de leur N2.
- `attributes.is_filterable` reste le « peut servir de filtre en général » ; `category_attributes.is_filter` = « affiché comme filtre dans cette catégorie ».
- **Validation publication** : nouveau service (DI) qui vérifie que tous les `category_attributes.is_required_for_publication` sont renseignés avant publication ; nouvelle classe d'erreur dans `app/exceptions/catalogue_errors.ts`. Le back-office fournisseur expose le compteur « xx produits incomplets ».

**Modèles/types** : `CategoryAttribute` + `CategoryAttributeRange` (modèles), relations `Category.manyToMany(Attribute, pivot category_attributes)` et `CategoryAttribute.hasMany(CategoryAttributeRange)` ; `shared/types/category.ts` → `CategoryAttributeType` (avec `ranges: {minValue, maxValue}[]`), et extension de `ProductCatalogueFacets` pour résoudre l'ensemble d'attributs d'une catégorie (propres + **tous les ancêtres**, triés par `position`).

**Fichiers** : `database/migrations/*_create_category_attributes_table.ts`, `database/migrations/*_create_category_attribute_ranges_table.ts`, `app/models/category_attribute.ts`, `app/models/category_attribute_range.ts`, `app/services/catalogue_facets_service.ts` (résolution), `shared/types/category.ts`, `shared/types/attribute.ts`.

---

## Écart 2 — Marquage structuré

Absent (le « marquage » actuel = specs libres de ligne RFQ/devis). La technique de marquage **n'est pas un filtre** (reste de la donnée de fiche) → pas de facette Meilisearch, affichage seulement.

Tables :

- **`marking_techniques`** (référentiel fermé, 18 canoniques) : `id, slug, name, family, synonyms[]` + `marking_technique_translations` (i18n). Même patron que les matières.
- **`product_marking_positions`** : `id, product_id (FK), name, max_width_mm, max_height_mm, template_document_id (FK product_documents null), position (int)`. 1..N par produit.
- **`product_marking_position_techniques`** : `id, marking_position_id (FK), marking_technique_id (FK), max_colors (int null), default_setup_charge (decimal null)`. Techniques possibles par position + nb couleurs max + frais techniques.
- **`product_marking_price_tiers`** : `id, product_id (FK), marking_technique_id (FK), min_quantity (int), unit_price (decimal), currency (char3)`. Grille prix de marquage par technique/quantité (patron identique à `product_price_tiers`).
- Sur `products` : `printable (bool, default false)`. (Nombre de positions = dérivé du count.)

**Modèles** : `MarkingTechnique`, `ProductMarkingPosition`, `ProductMarkingPositionTechnique`, `ProductMarkingPriceTier` (+ relations `Product.hasMany(...)`).

---

## Écart 3 — Logistique / conditionnement

Table **1:1 `product_packagings`** (garde `products` léger) :

`product_id (unique FK)`, `package_type (string null — Polybag/Boîte cadeau/Étui/Tube/Vrac/Blister)`, `unit_gross_weight_g (int null)`, `inner_carton_qty (int null)`, `outer_carton_qty (int null)`, `outer_carton_length_mm / _width_mm / _height_mm (int null)`, `outer_carton_gross_weight_g (int null)`, `outer_carton_volume_m3 (decimal null)`, timestamps.

Rarement filtré → colonnes simples, pas d'EAV. Modèle `ProductPackaging` + `Product.hasOne(ProductPackaging)`.

---

## Écart 4 — Conformité produit

- **`certifications`** (référentiel fermé, 29 labels) : `id, slug, name, domain, synonyms[]` + `certification_translations`.
- **`product_certifications`** (pivot) : `product_id, certification_id` (PK composite), index `certification_id`. ⇒ certifs **au niveau produit** (aujourd'hui seulement `supplier_profiles.certifications text[]`, qu'on conserve pour le profil fournisseur).
- Sur `products` : `recycled_content_percent (int null)`, `caution_comment (text null)`.
- **Filtre dérivé « Éco-responsable »** : colonne `products.is_eco (bool, default false)` **maintenue par le pipeline d'indexation** (vraie si `recycled_content_percent > 0` OU matière ∈ {bio/recyclé/naturel} OU au moins un label éco) — calculée par la plateforme, jamais saisie. Poussée dans Meilisearch comme facette.
- Doc de conformité/sécurité : réutiliser `product_documents` en lui **ajoutant une colonne `type`** (enum : `spec_sheet`, `safety`, `certificate`, `marking_template`, `other`, défaut `spec_sheet`) via une migration d'altération — la table actuelle est minimale (`original_name`, `size_bytes`). Cette même colonne sert aussi au gabarit de marquage (écart 2).

---

## Écart 5 — Identité / classification

Colonnes sur **`products`** :
`brand (string null)`, `hs_code (string null)` (code douanier), `is_configurable (bool default false)`, `lifecycle_status (enum ['active','new','end_of_series','retired'] default 'active')` (les 4 états « Statut » ; `is_active` reste le simple on/off de publication), `released_at (date null)` (filtre « Nouveautés »), `supplier_category_raw (string null)` (traçabilité catégorie fournisseur brute).

Dans **`product_translations`** : `keywords (text[] null)`, `marketing_points (text[] null)` (par locale).

Dans **`product_variants`** : `gtin (string null)` (EAN/GTIN par variante).

---

## Écart 6 — Variante & couleur (2 niveaux + hex)

- **Couleur à 2 niveaux via l'EAV**, sans table dédiée : étendre **`attribute_values`** de `hex (char7 null)` et `parent_value_id (self-FK null)`. Deux attributs : `color-family` (N1, 14 valeurs) et `color-shade` (N2, 26 valeurs) ; chaque nuance N2 pointe sa famille N1 via `parent_value_id`. Cocher une famille attrape ses nuances (résolution par `parent_value_id`). `hex` alimente la pastille.
- Sur **`product_variants`** : `color_label (string null)` (libellé fournisseur, cherchable), `pantone (string null)` (affiché, jamais en filtre), `stock_quantity (int null)`, `stock_status (enum ['in_stock','out_of_stock','on_order'] null)` — pour le filtre « Stock ».

---

## Écart 7 — Commercial

Colonnes sur **`products`** : `lead_time_days (int null)` (délai indicatif), `rush_service (bool default false)`, `rush_lead_time_days (int null)`.

---

## Écart 8 — Médias

- `products.video_url (string null)`.
- `product_images.role (enum ['primary','view','lifestyle','marked'] null)` — typer le rôle (la table a déjà `position`, `secure_url`, dimensions).

---

## Écart 9 — Provenance (filtre 3 états)

- Conserver `products.origin_country` (code exact quand connu).
- `supplier_profiles.default_origin_scope (enum ['france','europe','outside_europe','per_product'] null)` — réponse du fournisseur à l'activation, appliquée à son catalogue à défaut d'origine produit.
- **Zone dérivée** pour le filtre : colonne `products.origin_zone (enum ['france','europe','other'] null)` calculée au moment de l'indexation (France si `origin_country='FR'` ; Europe si pays ∈ UE/EEE ou `made_in_europe` ; other si connu hors Europe ; **null = origine inconnue**, exclue des cases France/Europe). Le back-office fournisseur montre « xx produits sans origine renseignée ».

---

## Impact Meilisearch

Le mapping d'index produit doit exposer en **facettes filtrables** : chemin de catégorie (N1/N2/N3), `color-family` / `color-shade`, matière, certifications, `is_eco`, `stock_status`, `released_at` (Nouveautés), `origin_zone`, prix du palier le plus bas (tranches), MOQ (tranches), **plus les attributs EAV dont `category_attributes.is_filter = true`** (aplatis par slug d'attribut). Les bornes de `category_attribute_ranges` servent à construire les buckets numériques côté UI. La technique de marquage, le Pantone, le pays exact et la marque restent **hors facette** (données de fiche). Prévoir un **job de réindexation** après migration + backfill des colonnes dérivées (`is_eco`, `origin_zone`).

## Données de référence à injecter (seeders)

Réutiliser / étendre `attribute_seeder.ts`, `category_seeder.ts`, `supplier_seeder.ts`, `product_seeder.ts` et en ajouter :

- **Arbre de catégories** N1>N2(>N3) depuis « Champs par catégorie » (13 N1, ~45 N2) + `synonyms`.
- **Attributs par catégorie** : créer les attributs (un par concept/catégorie quand les valeurs diffèrent) + leurs `attribute_values` (avec `synonyms` = libellés fournisseurs), et les lignes `category_attributes` (`is_required_for_publication`, `is_filter`, `position`, `filter_ranges`) depuis les colonnes « Obligatoire » / « Sert de filtre » / « Ordre » / « Filtre par tranches ».
- **Listes fermées** : couleurs N1 (14, + hex) et N2 (26, + hex + `parent_value_id`) ; matières (31, familles + synonyms) ; techniques de marquage (18, familles + synonyms) ; certifications (29, domaines).
- Un **produit de démo complet** reprenant l'« Exemple casquette » (toutes sections renseignées) pour valider bout en bout.

## Séquencement conseillé

1. **Fondations filtrables** : écart 1 (`category_attributes`) + écart 6 (hex/parent sur `attribute_values`) + seeders taxonomie & listes fermées. C'est ce qui débloque le différenciateur « filtres par catégorie ».
2. **Identité/commercial/médias/provenance** (écarts 5, 7, 8, 9) : colonnes simples sur `products`/`product_variants`/`product_translations` + `supplier_profiles`.
3. **Conformité** (écart 4) : certifications produit + `recycled_content_percent` + dérivé `is_eco`.
4. **Logistique** (écart 3) : `product_packagings`.
5. **Marquage structuré** (écart 2) : tables marquage + grille prix.
6. **Meilisearch** : mise à jour du mapping + backfill + réindexation, à chaque étape qui ajoute une facette.

## Vérification (à chaque incrément)

1. `node ace migration:run` puis `migration:rollback` + re-run (tous les `down()` OK) ; `schema.ts` régénéré.
2. `node ace db:seed` → taxonomie, listes fermées et produit « casquette » insérés sans erreur.
3. Tests fonctionnels Japa (PostgreSQL, `pnpm test:db && pnpm test`) : résolution des attributs d'une catégorie (propres + hérités, tri par `position`), garde « obligatoire pour publication », filtrage multi-critères AND sur une catégorie, couleur famille→nuances. Factories dans `database/factories/`.
4. Réindexation Meilisearch + requête combinant 3 critères (ex. « sac à dos · RPET · 20-30 L ») renvoyant le bon sous-ensemble.
5. `pnpm typecheck` + `pnpm lint` verts.
6. Doc : `docs/changelog/AAAA-MM-JJ-slug.md` par incrément + mise à jour de `docs/search.md` pour les nouvelles facettes.

## Décisions arrêtées (25 oct. 2026)

- **`product_documents.type`** : colonne ajoutée (enum, défaut `spec_sheet`) — distingue fiche technique / gabarit de marquage / certificat / sécurité.
- **Tranches numériques** : **table enfant dédiée** `category_attribute_ranges` (bornes `min_value`/`max_value` + `position`), label rendu côté UI depuis bornes + unité + locale. Pas de JSONB — version la plus robuste (requêtable, validable, i18n sans chaîne figée).
- **Certifications & techniques de marquage** : **tables de référence dédiées** (+ translations), car listes fermées à domaine réutilisées hors facette.
- **Profondeur N3** : attributs attachables à **n'importe quel niveau** ; résolution sur **toute la chaîne d'ancêtres**. Les N3 peuvent ajouter leurs propres attributs en plus de ceux hérités de la N2.
