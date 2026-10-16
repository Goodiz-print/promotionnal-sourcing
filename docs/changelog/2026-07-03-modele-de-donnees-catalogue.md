# Modèle de données catalogue (prêt pour la recherche hybride)

> Date : 2026-07-03

Mise en place du socle catalogue (fournisseurs, catégories, attributs, produits) **conçu dès le départ pour la recherche multi-critères fiable** (le « crayon de couleur bleu → uniquement des crayons bleus »). Ce livrable pose uniquement le modèle de données ; le service d'embeddings, le moteur de recherche et le parseur de requête arriveront dans un prochain incrément.

- **Extensions PostgreSQL** (`database/migrations/…948_enable_search_extensions.ts`) : `vector` (pgvector), `pg_trgm` (recherche floue), `unaccent` (normalisation FR côté requête). Migration no-op hors PostgreSQL.
- **Tables créées** :
  - `suppliers` — fournisseur européen (nom, slug, pays ISO2, contact, `is_active`)
  - `categories` — taxonomie auto-référencée (`parent_id` SET NULL) + `synonyms text[]` pour le futur parseur
  - `attributes` — définitions de facettes (`slug`, `type` enum `string|number|boolean|enum`, `unit`, `is_filterable`)
  - `attribute_values` — valeurs énumérées (`value` canonique, `label`, `slug`, `synonyms text[]`), unique `(attribute_id, slug)`
  - `products` — cœur du catalogue (FK `supplier_id` CASCADE, `category_id` RESTRICT, prix, MOQ, `origin_country`, `made_in_europe`)
  - `product_attributes` — pivot facettes (**le mécanisme du ET fiable**) : `(product_id, attribute_id, attribute_value_id)` + `value_number`/`value_string`, unique `(product_id, attribute_id, attribute_value_id)`
- **Vectorisation & full-text** sur `products` :
  - `embedding vector(1024)` (nullable) + index **HNSW** `vector_cosine_ops` — prêt pour `mistral-embed` (peuplé par un futur job)
  - `search_vector tsvector` en **colonne générée immuable** `to_tsvector('french', name || description)` + index **GIN** (`unaccent` reste appliqué côté requête, car STABLE et interdit dans une colonne GENERATED)
  - Index btree sur `supplier_id`, `category_id`, `origin_country`, `is_active`
- **Schéma généré** (`database/schema_rules.ts`) : `embedding`/`search_vector` exclus du schéma ORM (`skipColumns`, gérés en SQL brut, jamais sérialisés). Wiring du fichier de règles via `config/database.ts` (`schemaGeneration.rulesPaths`).
- **Modèles** (`app/models/`) : `supplier`, `category` (self-ref + enfants), `attribute`, `attribute_value`, `product` (belongsTo supplier/category, manyToMany `attributeValues` via le pivot), `product_attribute`.
- **Types partagés** (`shared/types/`) : `supplier.ts`, `category.ts`, `attribute.ts`, `product.ts` (`XxxType` + `CreateXxxData`/`UpdateXxxData`).
- **Validateurs** (`app/validators/`) et **transformers** (`app/transformers/`) create/update pour chaque ressource ; `ProductTransformer` n'expose jamais `embedding`/`searchVector`.
- **Seeders de démo** (`database/seeders/`, enregistrés dans `main_seeder.ts`) : 3 fournisseurs, catégories crayon/stylo/sac, attributs couleur/matière, et 6 produits (dont 2 crayons bleus, 1 crayon rouge, 1 stylo bleu, 1 sac bleu) prouvant le filtrage : `category=crayon ET color=blue` ⇒ **uniquement les 2 crayons bleus**.
- **Infra** : image Docker `pgvector/pgvector:pg18` (dev + test + CI). En test, `DB_CONNECTION=pg` bascule la connexion sur PostgreSQL (SQLite ne supporte ni pgvector ni tsvector) ; `.env.example` complété avec les variables `DB_*`.
