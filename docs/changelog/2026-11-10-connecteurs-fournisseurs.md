# Connecteurs de flux fournisseurs (import des catalogues réels)

> Date : 2026-11-10

Nouvelle commande `node ace supplier:import <pfconcept|passot|inspirion|axpol|all>` pour peupler les bases de dev / staging avec les catalogues réels des fournisseurs : produits, déclinaisons, prix nets, stock, marquage et images. Documentation complète : [`docs/supplier-feeds.md`](../supplier-feeds.md).

## Commande

- Options : `--limit` (200 par défaut), `--locale` (`fr`, `en`, `de`, `es`), `--dry-run`, `--store-images` (copie dans Cellar), `--skip-images`.
- Refusée avec `NODE_ENV=production`, sauf `--force` : les prix importés sont les prix nets confidentiels du compte.
- Relançable : un second import met à jour, sans doublon.
- Bilan affiché : produits récupérés, créés, mis à jour, en échec, désactivés, plus les catégories et techniques de marquage non reconnues.
- `--dry-run` n'écrit rien en base, pas même la catégorie de repli.

## Connecteurs

- **PF Concept** : flux JSON v3, produits et données de marquage publics ; prix, stock et prix de marquage propres au compte.
- **Passot / PiDesign** : API REST, déclinaisons regroupées par `main_sku`, zones de marquage avec leurs paliers.
- **Inspirion, Axpol** : squelette et configuration seulement, en attente de la documentation fournisseur.

## Données

- Migration `1794000000010_add_external_id_to_products` : colonne `products.external_id` (nullable) et index unique `(supplier_id, external_id)`.
- Migration `1794000000011_add_source_url_to_product_images` : colonne `product_images.source_url` (nullable), URL d'origine d'une image importée. Avec `--store-images`, une image déjà copiée est réutilisée sans re-téléchargement, et un téléchargement en échec laisse la galerie intacte.
- `is_active` n'est posé qu'à la création. Sur un flux complet (moins de `--limit` produits), les fiches absentes du flux sont désactivées.
- Slug unique (suffixe `-2`, `-3`…) ; `is_eco` tient compte des labels éco existants.
- Prix de la fiche : grille entière de la déclinaison la moins chère, jamais un mélange de grilles. Code douane conservé tel quel.
- Rapprochement des libellés fournisseur avec les synonymes existants des catégories, couleurs (une nuance entraîne sa famille), matières et techniques. Une catégorie non reconnue va dans la nouvelle catégorie « Non classé » (`non-classe`, créée à la volée).
- Variantes, paliers et marquage passent par `ProductVariantService` / `ProductMarkingService`.
- Colonnes dérivées recalculées : zone d'origine, éco, statut de stock.
- La réindexation passe par `ProductChanged`.

## Configuration

Nouvelles variables optionnelles : `PFCONCEPT_FEED_CODE`, `PASSOT_API_KEY`, `INSPIRION_API_KEY`, `AXPOL_API_KEY` (secrets, `.env` uniquement), `SUPPLIER_FEED_TIMEOUT_MS` et `SUPPLIER_FEED_USER_AGENT`. Les URLs de flux sont masquées dans les logs (`redactUrl` : code distributeur de tout format, valeurs exactes des secrets, query string).

## Tests

Les tests tournent sans réseau, sur des fixtures anonymisées à prix fictifs.

- Unitaires : parsing, rapprochement, normalisation PF Concept et Passot.
- Fonctionnels : création, idempotence, couleurs, techniques, catégorie de repli, dry-run, échec isolé.
