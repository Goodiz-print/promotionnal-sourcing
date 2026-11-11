# Panier de devis

L'acheteur constitue sa demande comme un panier marchand : il ajoute des
produits depuis le catalogue, ajuste quantités et précisions, puis valide. À la
validation, le panier est **éclaté en une demande de devis (RFQ) par
fournisseur** : chacun ne reçoit que ses propres lignes.

Le panier ne remplace pas le formulaire de demande (`rfqs.create`), qui reste
le chemin pour un besoin hors catalogue ou une demande multi-destinataires
(même liste envoyée à plusieurs fournisseurs en concurrence).

## Modèle

- **`quote_cart_items`** (migration `1794000000012_create_quote_cart_items_table`) :
  `user_id`, `organization_id`, `product_id` (tous `CASCADE`), `quantity`,
  `note`, timestamps. Unicité `(user_id, organization_id, product_id)`.
- **Pas de table d'en-tête** : il n'y aurait rien à y stocker. Le panier est
  l'ensemble des lignes d'un utilisateur dans une organisation.
- **Par utilisateur, dans l'organisation courante** : chaque membre a son
  panier ; changer d'organisation change de panier. Les demandes créées
  appartiennent à l'organisation, comme toutes les RFQ.
- `product_id` en `CASCADE` (et non `SET NULL` comme `rfq_items`) : rien n'est
  encore parti, un produit supprimé du catalogue quitte simplement le panier.

## Service (`QuoteCartService`)

| Méthode                   | Comportement                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `add`                     | relit le produit (`ProductCatalogueService#findForRfq`), 404 s'il n'est pas demandable. Quantité par défaut : `min_quantity`, sinon 1. Déjà présent : rien n'est modifié, message « déjà dans votre panier » |
| `updateItem`/`removeItem` | filtrés sur `(user_id, organization_id)` : la ligne d'un autre panier est un **404**                                                                                                                         |
| `list`                    | lignes groupées par organisation fournisseuse, dans l'ordre d'ajout                                                                                                                                          |
| `checkout`                | une RFQ par groupe joignable, **en une transaction** ; les lignes validées quittent le panier                                                                                                                |
| `count`/`has`             | pastille du bandeau, état « dans le panier » de la fiche produit                                                                                                                                             |

### Groupe « non joignable »

Un produit devenu indemandable (désactivé, rejeté, organisation archivée) ou
dont l'organisation fournisseuse n'est plus éligible (`supplier`/`both`, non
archivée) est rangé dans un groupe `supplierOrganizationId: null`, affiché en
dernier. Il est exclu de la validation et **reste au panier**. Un panier qui
n'a que ce groupe ne peut pas être validé (`QuoteCartEmptyException`).

### Validation

Chaque demande reçoit :

- le titre saisi suffixé du nom du fournisseur (`Salon 2027 — Nordic Promo`),
  tronqué à 180 caractères (le formulaire limite la saisie à 120) ;
- la description et l'échéance communes ;
- ses lignes : désignation (nom localisé du produit), quantité, `productId`,
  `categoryId`, et la note de la ligne en `description` ;
- son fournisseur pour unique destinataire.

Selon le rôle :

- `canManageRfq` (owner/admin/manager) : chaque demande est **publiée puis
  envoyée** ; après commit, `RfqSent` est émis par demande (mail + notification
  in-app, comme un envoi depuis l'écran de détail) et `rfq_sent` journalisé ;
- `member` (`canCreateRfq` seulement) : les demandes sont créées **en
  brouillon**, un responsable les enverra — même règle qu'aujourd'hui où un
  membre rédige sans envoyer.

`RfqService#create`, `#publish` et `#send` acceptent pour cela un client de
transaction optionnel.

L'ajout d'un produit au panier journalise `rfq_product_added` : c'est le même
signal de funnel que l'ajout à un brouillon (écran « demande » de l'admin).

## Routes (`start/routes/quote_cart.ts`)

Groupe `:locale` + `auth` + `onboarded`, toutes gardées par `canCreateRfq`.

| Méthode | Chemin                  | Nom                        |
| ------- | ----------------------- | -------------------------- |
| GET     | `/quote-cart`           | `quote_cart.show`          |
| POST    | `/quote-cart/items`     | `quote_cart.items.store`   |
| PATCH   | `/quote-cart/items/:id` | `quote_cart.items.update`  |
| DELETE  | `/quote-cart/items/:id` | `quote_cart.items.destroy` |
| POST    | `/quote-cart/checkout`  | `quote_cart.checkout`      |

Réponses par redirection Inertia ; la validation renvoie sur `rfqs.index`.

## Écrans

- **Bandeau** : `quote_cart_nav_button.vue`, icône panier et pastille
  (`BaseCountBadge`, extrait de la cloche). Prop partagée `quoteCartCount`,
  `undefined` pour qui n'a pas `canCreateRfq` dans son organisation courante
  (l'icône est alors absente).
- **Catalogue** : `quote_cart_add_button.vue` en surimpression de chaque carte
  (à côté du lien, un bouton dans un lien n'étant pas valide). Ajout à la
  quantité minimale ; seule `quoteCartCount` est rechargée.
- **Fiche produit** : `product_quote_actions.vue` — quantité + « Ajouter au
  panier de devis » ; « Dans votre panier » et lien vers le panier une fois
  ajouté ; lien secondaire « Demande détaillée » vers `rfqs.create?productId=`.
  `rfqContext` vaut `{ canCreateRfq, inCart }`.
- **Panier** (`pages/quote_cart/show.vue`) : un `BaseSection` par fournisseur
  (`quote_cart_group.vue`), lignes éditables enregistrées après une pause de
  saisie (`quote_cart_line.vue`, `router.patch` + `only: ['groups']`), alerte
  sous le minimum de commande, formulaire de validation qui annonce le nombre de
  demandes et leurs destinataires (`quote_cart_checkout_form.vue`).

i18n : `resources/lang/<langue>/quote_cart.json`, 9 langues.

## Tests

- `tests/functional/quote_cart.spec.ts` : ajout (quantité minimale, quantité
  saisie, sans doublon, produit masqué), groupement et pastille, état de la
  fiche produit, groupe non joignable, édition/retrait, cloisonnement (404),
  organisation fournisseuse refusée ; validation multi-fournisseurs (une RFQ
  publiée et envoyée par fournisseur, lignes et destinataire propres, `RfqSent`
  émis deux fois, panier vidé), `member` → brouillons sans envoi, groupe non
  joignable conservé, panier vide et titre manquant refusés.
- `tests/inertia/quote_cart.spec.ts`, `quote_cart_buttons.spec.ts`,
  `product_quote_actions.spec.ts`.

## Hors périmètre

- La route `rfqs.items.from_product` et `RfqService#addProductItem` restent en
  place mais ne sont plus appelées par la fiche produit : à retirer si le panier
  est adopté.
- Aucun lien « lot » n'est conservé entre les demandes issues d'une même
  validation.
