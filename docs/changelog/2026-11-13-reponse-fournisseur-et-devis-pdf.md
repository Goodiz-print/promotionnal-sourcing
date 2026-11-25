# Enregistrement de la réponse du fournisseur et de son devis PDF

> Date : 2026-11-13

Suite de la réception des mails entrants (#223) : chaque réponse reçue devient un message du fil de la demande, ses pièces jointes sont conservées, et un PDF est enregistré comme devis du fournisseur (#224). Le devis structuré saisi dans l'application est conservé : les deux formes coexistent. Détail dans `docs/quotes.md` (section « Devis reçu par mail, en PDF ») et `docs/storage.md`.

## Comportement

- `InboundMailReceived` a désormais un écouteur, `OnInboundMailReceived`, qui appelle `SupplierReplyService#record`.
- Le mail devient un message du fil de la demande pour ce destinataire : le fil est ouvert à la première réponse, un seul par couple demande / fournisseur. Le message n'a pas d'auteur ; son corps est la partie texte du mail (à défaut son HTML réduit à du texte), borné à `MESSAGE_MAX_LENGTH`.
- Les pièces jointes acceptées deviennent celles du message. Un PDF est compressé par `PdfService` ; le journal des mails est repointé vers le fichier compressé et l'original est purgé.
- Chaque PDF est enregistré comme devis du fournisseur. Avec au moins un PDF, le destinataire passe `sent`/`viewed` → `responded`. Sans PDF, c'est un simple message et le statut ne change pas.
- Plusieurs devis successifs : rien n'est écrasé. `QuoteService#currentDocumentsFor` renvoie ceux de la dernière réponse (ils font foi), `#documentsFor` tous.
- Une réponse à une demande close ou expirée (adresse relais encore valide) est enregistrée sans changer le statut. Un destinataire `declined` le reste.
- Un mail sans texte ni fichier conservé ne crée pas de message : il reste dans le journal.
- `htmlToText` ne lève jamais (entité invalide laissée telle quelle) et travaille en temps linéaire sur au plus `HTML_TEXT_SOURCE_MAX` caractères.
- Tout part de la ligne `rfq_suppliers` : aucun compte ni membre n'est requis côté fournisseur (#218).
- Message, pièces jointes, devis et statut sont écrits dans une seule transaction. En cas d'échec, rien n'est écrit, les PDF compressés sont libérés et le mail est rejoué. Un mail rejoué n'est enregistré qu'une fois.
- Nouvel événement `SupplierReplyRecorded` (`inboundMailId`, `rfqSupplierId`, `conversationId`, `messageId`, `quoteDocumentIds`, `responded`), émis une fois par mail après le commit, pour la transmission à l'agence (#225).

## Schéma

- `conversations.rfq_supplier_id` (facultative, unique quand elle est renseignée).
- `messages.inbound_mail_id` (facultative, unique).
- Table `message_attachments` : `message_id`, `storage_object_id`, `filename`, `mime_type`, `size_bytes`. Ajoutée à `STORAGE_REFERENCES`.
- Table `quote_documents` : `rfq_id`, `rfq_supplier_id`, `message_id`, `message_attachment_id` (unique), `received_at`.

## Code

- Services : `SupplierReplyService` (nouveau), `ConversationService` (`threadForRecipient`, `recordInbound`, `findInboundMessage`, `announce`), `QuoteService` (`recordDocuments`, `documentsFor`, `currentDocumentsFor`), `RfqService#markRespondedByMail`, `StorageService#read`.
- Modèles `MessageAttachment` et `QuoteDocument` ; types dans `shared/types/supplier_reply.ts`, `conversation.ts`, `quote.ts` ; `htmlToText` dans `shared/helpers/inbound_mail.ts`.
- Aucune route ni écran : l'affichage relève de #225 et #226.

## Tests

- `tests/functional/supplier_replies.spec.ts`, `tests/unit/inbound_mail_helpers.spec.ts` (`htmlToText`).
- Utilitaires partagés : `tests/utils/pdf.ts` (compresseur factice), `sentRfq` et `deliver` dans `tests/utils/inbound_mail.ts`.
