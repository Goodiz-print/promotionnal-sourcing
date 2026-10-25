# Attributs filtrables par catégorie (fondations — ÉTAPE 1)

> Date : 2026-10-25

Première étape du plan d'extension du modèle produit : poser les fondations
**filtrables** (écarts 1 et 6 du plan) pour une recherche multi-critères fiable
qui change selon la catégorie. Aligné sur les classeurs Virgile (19 oct. 2026),
eux-mêmes calés sur PromoStandards / Midocean.

## Schéma (migrations)

- **`category_attributes`** — pivot catégorie ↔ attribut : `category_id`
  (FK `categories`, CASCADE), `attribute_id` (FK `attributes`, CASCADE),
  `is_required_for_publication` (bool), `is_filter` (bool), `position` (int),
  timestamps. `unique(category_id, attribute_id)`, index `category_id`.
- **`category_attribute_ranges`** — table enfant (pas de JSONB) des tranches de
  filtre d'un attribut numérique : `category_attribute_id` (FK, CASCADE),
  `min_value` / `max_value` (`decimal(12,2)`, nullable = borne ouverte),
  `position`, timestamps. **Le libellé n'est pas stocké** : il est rendu côté UI
  depuis les bornes + l'unité de l'attribut + la locale.
- **`attribute_values`** — deux colonnes ajoutées : `hex` (`char(7)`, pastille
  couleur) et `parent_value_id` (self-FK, `ON DELETE SET NULL`) pour la couleur à
  2 niveaux (nuance N2 → famille N1).

## Modèles & types

- `app/models/category_attribute.ts`, `app/models/category_attribute_range.ts`.
- `Category` : `manyToMany(Attribute)` (pivot `category_attributes`) +
  `hasMany(CategoryAttribute)`. `AttributeValue` : self-ref `parent` / `children`.
- `shared/types/category.ts` : `CategoryAttributeType` (avec
  `ranges: { minValue, maxValue }[]`) et `CategoryAttributeRangeType`.
  `shared/types/attribute.ts` : `hex` et `parentValueId` sur `AttributeValueType`.

## Service de résolution

`app/services/catalogue_facets_service.ts` (`CatalogueFacetsService`, injecté) :

- `resolveForCategory(categoryId, locale?)` — ensemble d'attributs d'une
  catégorie = **ses attributs propres + ceux de tous ses ancêtres** (remontée de
  `parent_id` jusqu'à la racine), un attribut dédoublonné (niveau le plus proche
  prioritaire), trié par `position` puis `attributeId`, avec valeurs et tranches.
  Un attribut peut être rattaché à n'importe quel niveau (N2 ou N3).
- `resolveFilters(...)` — sous-ensemble `is_filter = true`.
- `missingRequiredAttributes(...)` / `assertPublishable(...)` — garde de
  publication : lève `ProductPublicationBlockedException`
  (`app/exceptions/catalogue_errors.ts`, 422) tant qu'un attribut
  `is_required_for_publication` de la catégorie ou d'un ancêtre n'est pas
  renseigné.

## Seeders (démo, régénérables depuis les classeurs)

- Arbre de catégories **N1 > N2** du classeur (15 N1, 45 N2, + synonymes), en plus
  des catégories de démo historiques (crayon/stylo/sac). Slugs N2 préfixés par le
  N1 (unicité globale).
- Couleur en **2 attributs** : `color` (famille, 14 valeurs + `hex` — les valeurs
  historiques blue/red/black/green sont conservées) et `color-shade` (nuance, 26
  valeurs + `hex` + `parent_value_id` + synonymes d'import).
- **`material`** enrichi (liste fermée du classeur + synonymes), plus un jeu curé
  d'attributs propres (Écriture>Stylos, Boissons>Gourdes, Casquettes>Casquettes)
  rattachés via `category_attributes` (obligatoire / filtre / ordre) et
  `category_attribute_ranges` (contenance ml, grammage g/m²).
- Produit de démo **« Casquette 6 panneaux marine »** portant couleur
  famille + nuance, matière et facettes propres : valide le filtrage ET.
- Données sources : `database/data/catalogue/{colors,materials,categories,category_attributes}.ts`.
  Certifications et techniques de marquage **ne sont pas** semées ici (étapes
  ultérieures).

## Recherche (Meilisearch)

Les nouvelles facettes (couleur N1/N2, matière, attributs par catégorie) sont
**déjà filtrables** : elles entrent dans `attributeValueIds`, dont le filtre
`attributeValueIds = X AND attributeValueIds = Y` garantit le ET. Backfill par
`node ace search:reindex` (aucun nouveau champ). Les **distributions de facettes
aplaties par slug** sont livrées dans une 2e PR (voir `docs/search.md`).

## Tests

`tests/functional/catalogue_facets.spec.ts` : résolution propre + héritée des
ancêtres et tri par position, origine (ancêtre) des facettes héritées, tranches
résolues (bornes, libellé non stocké), couleur famille → nuances via
`parent_value_id`, garde de publication (manquant / complet), filtrage ET
multi-critères sur les nouvelles facettes. Compteurs de démo ajustés (7 produits)
dans `catalogue`, `products_directory`, `product_search`, `suppliers_directory`,
`translation_policy`.
