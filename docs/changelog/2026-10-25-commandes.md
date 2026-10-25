# Commandes : création à l'acceptation d'un devis et suivi de statut (#6)

> Date : 2026-10-25

Accepter un devis crée désormais une commande, que le fournisseur confirme puis fait avancer jusqu'à l'expédition et que l'acheteur clôture à la réception. Détail : [`orders.md`](../orders.md).

- **Tables** : `orders` (`quote_id` unique, statut, adresses figées en `jsonb`, une date par statut) et `order_items` (copie des lignes du devis, libellé figé). Pas de `variant_id`.
- **Création** : `OnQuoteAcceptedCreateOrder` appelle `OrderService#createFromQuote` à chaque `QuoteAccepted`. Idempotente.
- **Statuts** : `pending` → `confirmed` → `in_production` → `shipped` → `delivered`, et `cancelled` tant que la production n'a pas commencé. Garde en base sur chaque transition.
- **Routes** : `orders.index|show|deliver|cancel` (acheteur) et `supplier.orders.index|show|confirm|produce|ship|cancel` (fournisseur). Le fournisseur dispose aussi de `produce` (non prévue dans l'issue) pour passer en production.
- **Événements** : `OrderCreated`, `OrderConfirmed`, `OrderInProduction`, `OrderShipped`, `OrderDelivered`, `OrderCancelled`, avec notifications in-app (`order.*`) pour l'autre côté.
- **Écrans** : historique et détail avec frise de suivi côté acheteur, liste avec actions inline côté fournisseur, entrées « Mes commandes » / « Commandes reçues » dans le menu, lien depuis le devis accepté. La frise se recharge à l'arrivée d'une notification.
- **Correctif lié** : `organizations.address_line1` / `address_line2` n'étaient jamais lus ni écrits (Lucid déduisait `address_line_1`). `database/schema_rules.ts` fixe désormais `columnName`, ce qui rend l'adresse de l'organisation utilisable — la commande la fige à sa création.
- **Hors périmètre** : pas de mail de commande ; pas d'adresse de livraison propre à la demande ou à la commande (celle de l'acheteur sert aux deux adresses) ; textes en `fr` / `en` seulement ; une commande dont le listener échoue n'est pas recréée automatiquement (l'échec est loggué, `createFromQuote` est rejouable).
