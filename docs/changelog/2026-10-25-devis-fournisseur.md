# Devis fournisseur : réponse chiffrée, comparaison, acceptation (#5)

> Date : 2026-10-25

- **Tables** `quotes` et `quote_items` (migrations `create_quotes_table`,
  `create_quote_items_table`) : un seul devis vivant par fournisseur et par demande
  (index unique partiel), montants calculés côté serveur, pas de `variant_id`.
- **`QuoteService`** : `draft → submitted → accepted | rejected | expired`, chaque
  transition gardée en base (`UPDATE … WHERE status`). Remettre un devis passe le
  destinataire en `responded` ; **accepter un devis rejette les autres devis remis
  et clôture la demande** (une transaction).
- **Routes fournisseur** : `GET supplier/quotes`, `GET supplier/rfqs/:rfqId/quotes/new`,
  `POST supplier/rfqs/:rfqId/quotes`, `GET|PATCH|DELETE supplier/quotes/:id`,
  `POST supplier/quotes/:id/submit`. **Routes acheteur** : `GET quotes/:id`,
  `PATCH quotes/:id/accept`, `PATCH quotes/:id/reject`.
- **Événements** `QuoteSubmitted`, `QuoteAccepted`, `QuoteRejected`. `QuoteSubmitted`
  envoie le mail `quote-received` (9 langues) aux responsables de l'acheteur ;
  `QuoteAccepted` est le point d'entrée des commandes (#6).
- **Expiration** : `ExpireRfqsJob` fait aussi expirer les devis ouverts des demandes
  échues et ceux dont la validité (`valid_until`) est passée.
- **Interface** : « Mes devis » (menu fournisseur), formulaire de devis, tableau
  comparatif dans la demande de l'acheteur, détail du devis avec accepter / rejeter ;
  libellés dans les 9 langues. Le message « dépôt de devis bientôt disponible » disparaît.
- `RfqService#acceptsResponses` centralise « la demande attend encore des réponses » ;
  décliner ou chiffrer une demande **close** est désormais aussi refusé.
- Détail : [`docs/quotes.md`](../quotes.md).
