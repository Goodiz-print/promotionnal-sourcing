# Variantes produit et paliers de prix

> Date : 2026-10-17

Ticket #53. Un produit peut avoir des **variantes** (SKU, valeurs d'attribut
couleur/taille, image) et une **grille de prix dégressive** par quantité.

- **Base** : tables `product_variants`, `product_variant_attributes` et
  `product_price_tiers` (unicité `(product_id, sku)` et
  `(product_id, variant_id, min_quantity)`), modèles `ProductVariant`,
  `ProductVariantAttribute`, `ProductPriceTier`, types dans `shared/types/product.ts`.
- **Prix** : `products.price_min` / `price_max` sont recalculés depuis les paliers.
- **Fournisseur** : `variants[]` et `priceTiers[]` sur `POST /supplier/products`
  et `POST /supplier/products/:id`, écrits dans la transaction du produit
  (`ProductVariantService`). Formulaire : sections variantes et paliers.
- **Fiche publique** : sélecteur de variante (change l'image) et tableau des paliers.
- **Catalogue** : `?sort=price_asc` trie par prix du premier palier.
- **Tests** : `tests/functional/product_variants.spec.ts`,
  `tests/inertia/product_variants.spec.ts`. Détail : `docs/catalogue.md`.
