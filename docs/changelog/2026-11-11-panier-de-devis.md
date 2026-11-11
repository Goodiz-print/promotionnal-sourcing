# Panier de devis

> Date : 2026-11-11

Les demandes de devis se constituent désormais comme un panier : l'acheteur
ajoute des produits depuis le catalogue, ajuste les quantités, puis valide. Le
panier est alors **éclaté en une demande par fournisseur**, chacun ne recevant
que ses lignes. Détail : [`docs/quote-cart.md`](../quote-cart.md).

- **Table `quote_cart_items`** (`user_id`, `organization_id`, `product_id`,
  `quantity`, `note`) : un panier par utilisateur dans son organisation
  courante, un produit au plus une fois.
- **Routes** (`canCreateRfq`) : `GET /:locale/quote-cart` (`quote_cart.show`),
  `POST /:locale/quote-cart/items` (`quote_cart.items.store`),
  `PATCH|DELETE /:locale/quote-cart/items/:id` (`quote_cart.items.update`,
  `quote_cart.items.destroy`), `POST /:locale/quote-cart/checkout`
  (`quote_cart.checkout`).
- **Validation** : une RFQ par fournisseur, en une transaction ; titre commun
  suffixé du nom du fournisseur, description et échéance communes. Publiées et
  envoyées pour owner/admin/manager, créées en brouillon pour un `member`. Les
  produits d'un fournisseur non joignable restent au panier.
- **Bandeau** : icône panier avec le nombre de produits (prop partagée
  `quoteCartCount`). Pastille extraite en `BaseCountBadge`, réutilisée par la
  cloche.
- **Catalogue** : bouton d'ajout rapide sur chaque carte produit.
- **Fiche produit** : « Ajouter au panier de devis » (avec quantité) remplace
  « Demander un devis » et le menu « Ajouter à une demande en brouillon » ;
  lien « Demande détaillée » vers le formulaire complet. `rfqContext` devient
  `{ canCreateRfq, inCart }`.
- `RfqService#create`/`publish`/`send` acceptent un client de transaction.
- i18n : `quote_cart.json` dans les 9 langues ; clés
  `products.show.addToDraft`/`chooseDraft` retirées.
- Tests : `tests/functional/quote_cart.spec.ts`,
  `tests/inertia/quote_cart.spec.ts`, `tests/inertia/quote_cart_buttons.spec.ts`.
