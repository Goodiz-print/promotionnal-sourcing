# Devis fournisseur (Quotes)

Réponse chiffrée d'un fournisseur à une demande de devis ([`rfq.md`](rfq.md)) :
prix unitaires, quantités, délais, personnalisation. L'acheteur compare les devis
remis et en accepte un (#5).

## Tables

| Table         | Colonnes notables                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quotes`      | `rfq_id`, `supplier_organization_id`, `status`, `valid_until` (date), `notes`, `total_amount` (numeric 14,2), `currency` (`EUR`), `submitted_at`, `decided_at` |
| `quote_items` | `quote_id`, `rfq_item_id`, `product_id` (nullable), `unit_price` (numeric 12,4), `quantity`, `total_price`, `lead_time_days`, `customization_details` (jsonb)  |

- **Un seul devis vivant** (`draft`, `submitted` ou `accepted`) par fournisseur et par
  demande : index unique partiel `quotes_one_live_per_supplier`. Un devis `rejected`
  ou `expired` libère la place.
- `quote_items` : une seule ligne par item de la demande (`unique(quote_id, rfq_item_id)`).
  Le fournisseur peut ne chiffrer qu'une partie de la demande.
- Pas de `variant_id` (l'issue d'origine le prévoyait) : la demande ne référence
  pas de variante, le devis non plus. La personnalisation voyage dans
  `customization_details`. `product_id` est repris de l'item de la demande, jamais
  du client.
- Les montants sont **toujours calculés par `QuoteService`** (prix unitaire ×
  quantité, arrondi au centime) ; le client n'envoie que prix, quantités et délais.

## Cycle de vie (`QuoteService`)

```
draft ──submit──▶ submitted ──accept──▶ accepted
  │                   │  └──reject──▶ rejected
  └───────────────────┴──expire────▶ expired
```

- **Créer / modifier** (`createDraft`, `updateDraft`) : le fournisseur doit être
  destinataire notifié (pas `pending`), ne pas avoir décliné, et la demande doit
  attendre encore des réponses (`RfqService#acceptsResponses` : publiée et
  échéance non passée). Les lignes sont validées contre la demande (item connu,
  une seule fois). `valid_until`, si renseignée, ne peut pas être passée.
- **Remettre** (`submit`) : exige au moins une ligne et une validité non dépassée.
  Le destinataire passe `responded` (`RfqService#markResponded`), le devis
  `submitted` et devient **figé**. Émet `QuoteSubmitted`.
- **Accepter** (`accept`) : en une transaction, le devis passe `accepted`, la
  demande est clôturée (`closed`) et tous les autres devis **remis** passent
  `rejected` (les brouillons ne sont pas touchés). Émet `QuoteAccepted` — le point
  d'entrée de la création de commande (voir [`orders.md`](orders.md)) — puis `QuoteRejected` pour chaque
  perdant.
- **Rejeter** (`reject`) : un seul devis, la demande reste ouverte. Émet `QuoteRejected`.
- **Expirer** : `ExpireRfqsJob` fait expirer les brouillons et devis remis des
  demandes qui viennent d'expirer (`expireForRfqs`) puis ceux dont `valid_until` est
  antérieure à aujourd'hui, heure de Paris (`expireOutdated`). Un devis décidé
  garde son statut. Prolonger l'échéance d'une demande échue ne ressuscite pas ses
  devis expirés : le fournisseur en ouvre un nouveau.

Chaque transition est un `UPDATE … WHERE status = …` : la garde est en base, donc
deux requêtes concurrentes (deux accept, accept + reject) ne s'écrasent pas.

## Routes (`start/routes/quotes.ts`)

| Méthode | Chemin                                     | Nom                       | Qui                             |
| ------- | ------------------------------------------ | ------------------------- | ------------------------------- |
| GET     | `/:locale/quotes/:id`                      | `quotes.show`             | acheteur (`canCreateRfq`)       |
| PATCH   | `/:locale/quotes/:id/accept`               | `quotes.accept`           | acheteur (`canManageRfq`)       |
| PATCH   | `/:locale/quotes/:id/reject`               | `quotes.reject`           | acheteur (`canManageRfq`)       |
| GET     | `/:locale/supplier/quotes`                 | `supplier.quotes.index`   | fournisseur (`canRespondToRfq`) |
| GET     | `/:locale/supplier/rfqs/:rfqId/quotes/new` | `supplier.quotes.create`  | fournisseur                     |
| POST    | `/:locale/supplier/rfqs/:rfqId/quotes`     | `supplier.quotes.store`   | fournisseur                     |
| GET     | `/:locale/supplier/quotes/:id`             | `supplier.quotes.show`    | fournisseur                     |
| PATCH   | `/:locale/supplier/quotes/:id`             | `supplier.quotes.update`  | fournisseur                     |
| POST    | `/:locale/supplier/quotes/:id/submit`      | `supplier.quotes.submit`  | fournisseur                     |
| DELETE  | `/:locale/supplier/quotes/:id`             | `supplier.quotes.destroy` | fournisseur (brouillon)         |

Cloisonnement : le devis d'une autre organisation est un **404**, jamais un 403 ;
un brouillon n'existe pas pour l'acheteur ; un fournisseur ne voit jamais les devis
de ses concurrents (l'écran de la demande reçue ne porte que son propre devis). Les
refus métier (`app/exceptions/quote_errors.ts`) deviennent des messages flash.

## Notification

`QuoteSubmitted` → `OnQuoteSubmitted` → `QuoteNotificationService#notifySubmitted` :
un mail `quote-received` par responsable de l'organisation acheteuse (rôles
`RFQ_MANAGER_ROLES`, dans leur langue). Un échec de mise en queue est loggué sans
faire échouer la remise ; un listener défaillant non plus (`QuoteService` publie
les événements après la transition et logge l'erreur). Le même listener crée une
**notification in-app** `quote.received` pour ces responsables
(`InAppNotificationService#quoteSubmitted`) ; `QuoteAccepted` / `QuoteRejected`
en créent une `quote.accepted` / `quote.rejected` pour les responsables du
fournisseur (`RFQ_RESPONDER_ROLES`). Voir [`entites-transverses.md`](entites-transverses.md).

## Écrans

- **Fournisseur** : bouton « Répondre par un devis » sur la demande reçue,
  `supplier/quotes/index.vue` (liste), `supplier/quotes/edit.vue` (formulaire tant
  que c'est un brouillon et que la demande est ouverte, lecture seule ensuite).
  Entrée « Mes devis » dans le menu.
- **Acheteur** : section « Devis reçus » dans `rfqs/show.vue`
  (`QuoteComparisonTable` : une colonne par fournisseur, une ligne par item, total,
  délai global ; moins cher et plus rapide soulignés parmi les devis en lice) et
  `quotes/show.vue` (détail, accepter / rejeter avec confirmation).

## Devise

`quotes.currency` existe (`EUR` par défaut) mais une seule devise est gérée : pas de
conversion, pas de sélecteur.

## Tests

`tests/functional/quotes.spec.ts` (service et écrans), `tests/inertia/*` pour les
props de `supplier/rfqs/show.vue` et `rfqs/show.vue`.
