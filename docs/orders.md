# Commandes (Orders)

Une commande naît de l'acceptation d'un devis ([`quotes.md`](quotes.md)) : le fournisseur
la confirme, la fait avancer jusqu'à l'expédition, l'acheteur confirme la réception (#6).

## Tables

| Table         | Colonnes notables                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orders`      | `quote_id` (**unique**), `buyer_organization_id`, `supplier_organization_id`, `status`, `shipping_address` / `billing_address` (jsonb), `total_amount` (numeric 14,2), `currency`, une date par statut atteint |
| `order_items` | `order_id`, `quote_item_id`, `product_id` (nullable), `name`, `quantity`, `unit_price` (numeric 12,4), `total_price`, `customization_details` (jsonb)                                                          |

- **Une commande par devis** : `orders.quote_id` est unique. La création est **idempotente**
  (`OrderService#createFromQuote`) : rejouer l'événement renvoie la commande existante, sans
  doublon ni nouvelle notification.
- **Copies figées** : les lignes reprennent le devis (`name` = libellé de l'item de la demande)
  et les adresses sont des copies `jsonb` de l'organisation acheteuse. Modifier ensuite le
  devis, la demande ou l'organisation ne réécrit pas une commande passée.
- **Adresses** : la demande ne porte pas d'adresse de livraison, donc la commande fige celle
  de l'acheteur pour la livraison **et** la facturation. Une adresse de livraison saisie sur
  la demande, ou par commande, reste à faire.
- Pas de `variant_id` (l'issue d'origine le prévoyait) : le devis n'en a pas non plus.
- `RESTRICT` sur `quote_id` / `quote_item_id` : un devis qui a donné une commande ne
  disparaît pas par cascade.

## Cycle de vie (`OrderService`)

```
pending ──confirm──▶ confirmed ──startProduction──▶ in_production ──ship──▶ shipped ──deliver──▶ delivered
   └─────────cancel──────┴──▶ cancelled
```

| Action            | Depuis                 | Vers            | Qui                     |
| ----------------- | ---------------------- | --------------- | ----------------------- |
| `confirm`         | `pending`              | `confirmed`     | fournisseur             |
| `startProduction` | `confirmed`            | `in_production` | fournisseur             |
| `ship`            | `in_production`        | `shipped`       | fournisseur             |
| `deliver`         | `shipped`              | `delivered`     | acheteur (réception)    |
| `cancel`          | `pending`, `confirmed` | `cancelled`     | acheteur ou fournisseur |

Chaque transition est un `UPDATE … WHERE status IN (…)` : la garde est en base, deux requêtes
concurrentes ne s'écrasent pas, et une action hors statut lève `OrderTransitionException`
(message flash côté écran, la commande ne bouge pas). Une action est aussi refusée si elle
n'est pas ouverte au côté appelant. `OrderService#availableActions` calcule ce que chaque
côté peut faire **maintenant** : le serveur décide, l'écran affiche.

## Création : `QuoteAccepted` → commande

`QuoteService#accept` publie `QuoteAccepted` ; `OnQuoteAcceptedCreateOrder` appelle
`OrderService#createFromQuote`. Comme pour les autres listeners, un échec est loggué sans
faire échouer l'acceptation, qui est déjà écrite.

## Événements et notifications

`OrderCreated`, `OrderConfirmed`, `OrderInProduction`, `OrderShipped`, `OrderDelivered`,
`OrderCancelled` (`app/events/`), publiés par `OrderService` **après** la transition.
`OnOrderCreated` et `OnOrderStatusChanged` créent une notification in-app (tableau dans
[`entites-transverses.md`](entites-transverses.md)). Le lien de la notification mène à
l'écran du côté du destinataire (`side` dans `data`). Pas de mail pour l'instant.

## Routes (`start/routes/orders.ts`)

| Méthode | Chemin                                 | Nom                       | Qui                             |
| ------- | -------------------------------------- | ------------------------- | ------------------------------- |
| GET     | `/:locale/orders`                      | `orders.index`            | acheteur (`canCreateRfq`)       |
| GET     | `/:locale/orders/:id`                  | `orders.show`             | acheteur (`canCreateRfq`)       |
| PATCH   | `/:locale/orders/:id/deliver`          | `orders.deliver`          | acheteur (`canManageRfq`)       |
| PATCH   | `/:locale/orders/:id/cancel`           | `orders.cancel`           | acheteur (`canManageRfq`)       |
| GET     | `/:locale/supplier/orders`             | `supplier.orders.index`   | fournisseur (`canRespondToRfq`) |
| GET     | `/:locale/supplier/orders/:id`         | `supplier.orders.show`    | fournisseur                     |
| PATCH   | `/:locale/supplier/orders/:id/confirm` | `supplier.orders.confirm` | fournisseur                     |
| PATCH   | `/:locale/supplier/orders/:id/produce` | `supplier.orders.produce` | fournisseur                     |
| PATCH   | `/:locale/supplier/orders/:id/ship`    | `supplier.orders.ship`    | fournisseur                     |
| PATCH   | `/:locale/supplier/orders/:id/cancel`  | `supplier.orders.cancel`  | fournisseur                     |

Aucune route ne crée de commande. La commande d'une autre organisation est un **404**, jamais
un 403.

## Écrans

- **Acheteur** : `orders/index.vue` (historique), `orders/show.vue` (frise de suivi, lignes,
  adresses, réception / annulation). `quotes/show.vue` renvoie vers la commande d'un devis accepté.
  Entrée « Mes commandes » dans le menu.
- **Fournisseur** : `supplier/orders/index.vue` (l'action suivante se déclenche depuis la
  ligne), `supplier/orders/show.vue`. Entrée « Commandes reçues » dans le menu.
- **Temps réel** : la frise se recharge seule quand une notification arrive (flux Transmit,
  `useNotificationStream`) — `order_detail.vue` observe le compteur de non-lues.
- Composants dans `inertia/components/orders/` ; textes `order.*` en `fr` / `en` (les autres
  langues retombent sur l'anglais, comme `notifications`).

## Tests

`tests/functional/orders.spec.ts` (création, idempotence, adresses figées, transitions,
notifications, cloisonnement, écrans) et `tests/inertia/order_detail.spec.ts`.
