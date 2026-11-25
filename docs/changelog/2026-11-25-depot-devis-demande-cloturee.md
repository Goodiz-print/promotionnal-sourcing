# Plus de dépôt de devis PDF sur une demande clôturée

> Date : 2026-11-25

Correction de #290. Sur « Demandes reçues » (`supplier.rfqs.show`), le formulaire de dépôt du
devis PDF restait affiché, et la route `POST /:locale/supplier/rfqs/:id/quote-documents`
l'acceptait, sur une demande que l'agence avait clôturée (devis retenu), tant que l'adresse
relais était dans son délai de grâce.

- L'ability `canUploadRfqQuoteDocument` regarde désormais le statut de la **demande** :
  le dépôt n'est possible que sur une demande `published` ou `expired`
  (`QUOTE_UPLOAD_ACCEPTING_RFQ_STATUSES`, `shared/types/rfq.ts` ; règle pure
  `rfqAcceptsQuoteUpload`, `shared/helpers/supplier_rfq.ts`).
- Une demande **clôturée** le refuse : la prop `canUploadQuote` passe à `false` (le
  formulaire disparaît) et la route répond 403.
- Une demande **expirée** l'accepte toujours, comme une réponse par mail : le dépôt est
  enregistré comme réponse tardive (#232) et l'agence peut rouvrir la demande en prolongeant
  l'échéance. La fenêtre de l'adresse relais continue de s'appliquer dans les deux cas.
- La messagerie du fil n'est pas modifiée : elle reste ouverte pendant le délai de grâce
  après la clôture.

Tests : `tests/unit/supplier_rfq.spec.ts` (règle pure), `tests/functional/rfq_message_abilities.spec.ts`
(ability : clôturée refusée, expirée accordée) et `tests/functional/supplier_received_requests.spec.ts`
(prop `canUploadQuote` à `false` et 403 sur la route de dépôt pour une demande clôturée).
