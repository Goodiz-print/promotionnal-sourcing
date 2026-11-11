# Panier de devis : prix dégressifs et options

> Date : 2026-11-11

Le panier de devis tient compte des **grilles de prix dégressives** du
catalogue et des **options** d'un produit (variante, marquage). Chaque ligne
affiche une **estimation indicative**, et les choix partent au fournisseur avec
la demande. Détail : [`docs/quote-cart.md`](../quote-cart.md).

- **Migration `1794000000013_add_options_to_quote_cart_items`** :
  `quote_cart_items.variant_id` (→ `product_variants`, `SET NULL`),
  `marking_position_technique_id` (→ `product_marking_position_techniques`,
  `SET NULL`), `marking_colors`. L'unicité passe à
  `(user_id, organization_id, product_id, variant_id) NULLS NOT DISTINCT` :
  deux variantes d'un même produit font deux lignes.
- **Ajout** (`quote_cart.items.store`) : accepte `variantId` (variante active du
  produit). La fiche produit envoie la variante affichée ; `rfqContext` devient
  `{ canCreateRfq, inCartVariantIds }` (« Dans votre panier » vaut pour la
  variante affichée).
- **Édition** (`quote_cart.items.update`) : accepte `variantId`,
  `markingPositionTechniqueId`, `markingColors`, contrôlés contre le produit de
  la ligne (variante active, marquage d'une de ses positions, couleurs ≤
  maximum de la technique). Option refusée ou variante déjà au panier : message
  d'erreur, rien n'est modifié. Retirer le marquage efface les couleurs.
- **Estimation** (helper partagé `shared/helpers/price_tiers.ts`, calcul exact
  en entiers) : prix unitaire du palier atteint (grille de la variante si elle
  en a une, sinon du produit), prix de marquage dégressif de la technique,
  frais techniques une fois par ligne, total arrondi au centime, palier
  suivant. Sans grille : « Prix sur devis ». Sous-total par fournisseur et par
  devise, signalé incomplet si une ligne n'est pas chiffrable.
- **Validation** : chaque ligne de demande reçoit dans `rfq_items.specs` la
  variante (libellé, SKU), le marquage (position, technique, couleurs) et
  l'estimation (`estimatedUnitPrice`, `estimatedMarkingUnitPrice`,
  `estimatedSetupCharge`, `estimatedTotal`). Les précisions sont désormais
  affichées sur les écrans de demande, acheteur et fournisseur.
- **UI** : sélecteurs variante / marquage / couleurs (`quote_cart_line_options`),
  bloc d'estimation (`quote_cart_line_estimate`), sous-total en pied de groupe.
- i18n : `quote_cart.line.*`, `quote_cart.estimate.*`, `quote_cart.errors.*`,
  `rfq.specs.*` dans les 9 langues.
- Tests : `tests/unit/price_tiers.spec.ts`, groupe « options et prix
  dégressifs » de `tests/functional/quote_cart.spec.ts`,
  `tests/inertia/quote_cart.spec.ts`, `product_quote_actions.spec.ts`,
  `rfq_item_list.spec.ts`. Nouvelle factory `ProductPriceTierFactory`.
