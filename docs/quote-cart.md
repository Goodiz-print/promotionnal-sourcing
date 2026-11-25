# Panier de devis

L'acheteur constitue sa demande comme un panier marchand : il ajoute des
produits depuis le catalogue, ajuste quantités et précisions, puis valide. À la
validation, le panier est **éclaté en une demande de devis (RFQ) par
fournisseur** : chacun ne reçoit que ses propres lignes.

Le panier ne remplace pas le formulaire de demande (`rfqs.create`), qui reste
le chemin pour un besoin hors catalogue ou une demande multi-destinataires
(même liste envoyée à plusieurs fournisseurs en concurrence).

## Modèle

- **`quote_cart_items`** (migrations `1794000000012_create_quote_cart_items_table`
  et `1794000000013_add_options_to_quote_cart_items`) : `user_id`,
  `organization_id`, `product_id` (tous `CASCADE`), `quantity`, `note`,
  timestamps, et les options : `variant_id` (→ `product_variants`),
  `marking_position_technique_id` (→ `product_marking_position_techniques`,
  position + technique), `marking_colors` — options en `SET NULL`, une option
  retirée du catalogue laisse la ligne sans elle. Unicité
  `(user_id, organization_id, product_id, variant_id) NULLS NOT DISTINCT` :
  deux variantes d'un produit font deux lignes.
- **Pas de table d'en-tête** : il n'y aurait rien à y stocker. Le panier est
  l'ensemble des lignes d'un utilisateur dans une organisation.
- **Par utilisateur, dans l'organisation courante** : chaque membre a son
  panier ; changer d'organisation change de panier. Les demandes créées
  appartiennent à l'organisation, comme toutes les RFQ.
- `product_id` en `CASCADE` (et non `SET NULL` comme `rfq_items`) : rien n'est
  encore parti, un produit supprimé du catalogue quitte simplement le panier.

## Service (`QuoteCartService`)

| Méthode                   | Comportement                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`                     | relit le produit (`ProductCatalogueService#findForRfq`), 404 s'il n'est pas demandable. `variantId` facultatif, variante active du produit. Quantité par défaut : `min_quantity`, sinon 1. Couple (produit, variante) déjà présent : rien n'est modifié, message « déjà dans votre panier » |
| `updateItem`/`removeItem` | filtrés sur `(user_id, organization_id)` : la ligne d'un autre panier est un **404**. Options contrôlées contre le produit (cf. ci-dessous)                                                                                                                                                 |
| `list`                    | lignes des produits **publiés**, groupées par organisation fournisseuse, dans l'ordre d'ajout                                                                                                                                                                                               |
| `checkout`                | une RFQ par groupe, **en une transaction** ; les lignes validées quittent le panier                                                                                                                                                                                                         |
| `count`/`cartVariantIds`  | pastille du bandeau (lignes publiées seulement), variantes déjà au panier pour la fiche produit                                                                                                                                                                                             |

### Options et estimation

Une ligne peut préciser une **variante** et un **marquage** (une technique sur
une position, et un nombre de couleurs). `updateItem` refuse
(`QuoteCartInvalidOptionException`, message flash) une variante inactive ou
d'un autre produit, un marquage d'un autre produit, des couleurs au-delà du
`max_colors` de la technique ou sans marquage ; changer pour une variante déjà
au panier lève `QuoteCartDuplicateLineException`. Retirer le marquage efface
les couleurs.

`list` renvoie, par ligne (`QuoteCartItemTransformer`), les options proposées
(`variantOptions`, `markingOptions`) et une **estimation indicative**
(`estimate`), calculée par `shared/helpers/price_tiers.ts` (entiers en
dix-millièmes, aucune erreur flottante) :

- prix unitaire du palier atteint (seuil inclus) de la grille de la variante si
  elle en a une, sinon de la grille produit ;
- prix de marquage unitaire du palier atteint de la technique (même devise que
  le produit), frais techniques (`default_setup_charge`) une fois par ligne ;
- total = quantité × (unitaire + marquage) + frais, arrondi au centime ;
- palier suivant (« dès 500 pièces : 1,60 € ») ;
- `null` sans grille (« Prix sur devis ») ; sous le premier seuil, pas de total ;
  marquage sans prix connu : total `partial`.

Chaque groupe porte un sous-total par devise et `estimateComplete` (faux dès
qu'une ligne n'est pas entièrement chiffrée). L'écran rappelle que le devis
du fournisseur fait foi.

### Produits dépubliés (#240)

Un produit publié a toujours un fournisseur destinataire : seules les fiches
rattachées à une organisation sont publiées (#240). Le panier ne liste donc que
les lignes dont le produit est publié (actif, non rejeté, fiche rattachée à une
organisation vivante `supplier`/`both`) : chaque groupe a un
`supplierOrganizationId`, il n'y a plus de groupe « non joignable ».

Une ligne dont le produit est dépublié après l'ajout (désactivé, rejeté, fiche
détachée, organisation archivée ou devenue inéligible) est **masquée** : ni
listée, ni comptée dans la pastille, ni validée. Elle reste en base et
réapparaît si le produit est republié (fiche rattachée de nouveau, par
exemple). Un panier sans ligne publiée ne peut pas être validé
(`QuoteCartEmptyException`).

Dans sa transaction, la validation verrouille (`FOR SHARE`) les fiches
fournisseur des lignes envoyées et vérifie qu'elles sont toujours rattachées à
l'organisation de leur groupe. Un détachement concurrent (verrou `FOR UPDATE`)
attend la fin de la validation ; s'il l'a précédée, rien n'est créé
(`QuoteCartChangedException`, message `quote_cart.errors.supplierUnavailable`)
et le panier reste intact.

### Validation

Chaque demande reçoit :

- le titre saisi suffixé du nom du fournisseur (`Salon 2027 — Nordic Promo`),
  tronqué à 180 caractères (le formulaire limite la saisie à 120) ;
- la description et l'échéance communes ;
- ses lignes : désignation (nom localisé du produit), quantité, `productId`,
  `categoryId`, la note de la ligne en `description`, et en `specs` les options
  et l'estimation à clés stables (`QUOTE_CART_SPEC_KEYS` : `variant`, `sku`,
  `markingPosition`, `markingTechnique`, `markingColors`, `estimatedUnitPrice`,
  `estimatedMarkingUnitPrice`, `estimatedSetupCharge`, `estimatedTotal` — seules
  les valeurs connues ; pas de total s'il est partiel). `rfq_item_list.vue` les
  affiche aux deux parties, libellées par `rfq.specs.<clé>` ;
- son fournisseur pour unique destinataire ;
- le **lot de panier** `batch_id` (#229) : un uuid tiré une fois par validation
  et commun à toutes les demandes qu'elle crée, exposé en `batchId` dans
  `RfqType` (liste « mes demandes ») et `RfqDetailType`. Deux validations donnent
  deux lots ; une demande créée seule (`RfqService#create` hors panier) garde
  `null`. « Mes demandes » (#228) regroupe les demandes par lot (« Panier du …
  · N demandes », voir `docs/rfq.md`).

Avec `canSendRfq` — tout membre de l'agence, `member` compris depuis #216 —
chaque demande est **publiée puis envoyée** ; après commit, `RfqSent` est émis
par demande (mail + notification in-app, comme un envoi depuis l'écran de
détail) et `rfq_sent` journalisé. Sans ce droit, les demandes seraient créées
en brouillon : le chemin reste dans `QuoteCartService#checkout` (`send: false`),
mais aucun rôle d'agence n'y mène plus.

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
  La variante affichée part au panier ; `rfqContext` vaut
  `{ canCreateRfq, inCartVariantIds }`.
- **Panier** (`pages/quote_cart/show.vue`) : un `BaseSection` par fournisseur
  (`quote_cart_group.vue`), lignes éditables enregistrées après une pause de
  saisie (`quote_cart_line.vue`, `router.patch` + `only: ['groups']` +
  `async: true`), options enregistrées aussitôt (`quote_cart_line_options.vue`).
  Les changements en attente d'une ligne sont fusionnés
  (`useQuoteCartLineSave`) : quantité et note saisies dans la même pause
  partent ensemble, un choix d'option emporte la saisie en attente, et un
  enregistrement n'annule pas celui d'un autre champ ou d'une autre ligne.
  Estimation par ligne
  (`quote_cart_line_estimate.vue`) et sous-total en pied de groupe, alerte
  sous le minimum de commande, formulaire de validation qui annonce le nombre de
  demandes et leurs destinataires (`quote_cart_checkout_form.vue`).

i18n : `resources/lang/<langue>/quote_cart.json`, 9 langues.

## Tests

- `tests/functional/quote_cart.spec.ts` : ajout (quantité minimale, quantité
  saisie, sans doublon, produit masqué), groupement et pastille, état de la
  fiche produit, produit dépublié masqué (fournisseur inéligible, fiche
  détachée puis rattachée), édition/retrait, cloisonnement (404),
  organisation fournisseuse refusée ; validation multi-fournisseurs (une RFQ
  publiée et envoyée par fournisseur, lignes et destinataire propres, `RfqSent`
  émis deux fois, panier vidé), `member` → demandes envoyées (#216), ligne
  dépubliée ni envoyée ni supprimée, fiche détachée pendant la validation
  (rien créé), panier vide et titre manquant refusés.
- `tests/inertia/quote_cart.spec.ts`, `quote_cart_buttons.spec.ts`,
  `product_quote_actions.spec.ts`.

## Hors périmètre

- Les `specs` ne pré-remplissent pas le devis structuré du fournisseur
  (`quote_items.customization_details`). Elles figurent en revanche dans le mail
  de demande et sa relance depuis #219 (variante, référence, marquage, prix
  indicatifs), et sur l'écran « Demandes reçues ».
- La route `rfqs.items.from_product` et `RfqService#addProductItem` restent en
  place mais ne sont plus appelées par la fiche produit : à retirer si le panier
  est adopté.

## Après la validation

Chaque demande suit le parcours devis par mail (#234, résumé en tête de
`docs/rfq.md`) : mail complet au fournisseur à son adresse de réception confirmée (à défaut
celle de son organisation ou ses responsables, #217),
anonyme s'il n'est pas abonné, réponse par mail + PDF transmise à l'agence,
puis suivi dans « Mes demandes » (regroupé par lot de panier).
