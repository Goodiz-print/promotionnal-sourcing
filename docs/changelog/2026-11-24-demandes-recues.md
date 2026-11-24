# « Demandes reçues » : à traiter, répondu, expiré, et devis envoyé

> Date : 2026-11-24

Issue #230, pendant fournisseur de « Mes demandes » (#228). Côté fournisseur,
chaque demande reçue montre un statut lisible et le devis qu'il a envoyé ; il
peut déposer son devis PDF depuis l'écran, en alternative à la réponse par mail.

- **Statut lisible** par destinataire (`SupplierRfqState`, `myState` sur
  `SupplierRfqType`) : **à traiter** (`sent` / `viewed`), **répondu**
  (`responded`, signalé « réponse tardive » après l'échéance, #232), **expiré**
  (`expired`, posé par `ExpireRfqsJob`), **décliné**. Calcul pur
  `supplierRfqState` (`shared/helpers/supplier_rfq.ts`) ; la correspondance
  `SUPPLIER_RFQ_STATE_STATUSES` sert aussi au filtre SQL. Il remplace les
  statuts techniques dans la liste et l'en-tête du détail.
- **Liste** (`GET /:locale/supplier/rfqs`, `supplier.rfqs.index`) : filtre par
  statut dans la query string (`?status=expired`), visite Inertia
  `preserveState` ; un filtre invalide est ignoré. État vide distinct quand le
  filtre ne renvoie rien. Nouvelle prop `filters`.
- **Service** : `RfqService#listForSupplier(organizationId, filters)` — colonnes
  explicites, agence et ligne du fournisseur préchargées, items comptés en
  sous-requête (`$extras.itemsCount`) : plus de préchargement des items.
- **Détail** (`supplier.rfqs.show`) : section **« Devis envoyé »** (props
  `documents`, `canUploadQuote`) — fichier, date, envoi par mail ou depuis la
  plateforme (`QuoteService#documentsSentBy`, `SupplierQuoteDocumentTransformer`).
  Le devis structuré reste accessible par « Voir mon devis ».
- **Téléchargement** : `GET /:locale/supplier/quote-documents/:id/download`
  (`supplier.quote_documents.download`, `SupplierQuoteDocumentsController#download`),
  réservé aux membres qui répondent aux demandes (`RFQ_RESPONDER_ROLES`) de
  l'organisation destinataire (ability `canDownloadSentQuoteDocument`). Sert
  toujours le **fichier d'origine** (`QuoteService#findDocumentForSupplier`),
  jamais la copie au nom de l'agence (#238). Agence, autre fournisseur ou simple
  membre : 403 ; devis inconnu : 404.
- **Dépôt du PDF depuis l'écran** : `POST /:locale/supplier/rfqs/:id/quote-documents`
  (`supplier.quote_documents.store`), formulaire Inertia multipart (`useForm`),
  validator `supplierQuoteDocumentValidator` (PDF, `DOCUMENT_MAX_SIZE` = 20 Mo,
  mot d'accompagnement facultatif). `SupplierReplyService#recordUpload` applique
  **le même traitement qu'une réponse par mail** : vérification de l'en-tête
  `%PDF-`, compression, copie au nom de l'agence pour un non abonné, message du
  fil écrit par le membre (`ConversationService#recordUploaded`), devis
  `quote_documents`, destinataire « répondu » (tardif après l'échéance), puis
  `SupplierReplyRecorded` → transmission à l'agence par mail et notification
  (#225). Ability `canUploadRfqQuoteDocument` : membres `RFQ_RESPONDER_ROLES`,
  fil ouvert (même fenêtre que la réponse par mail), demande non déclinée —
  statut relu sous verrou (`acceptsQuoteUpload`, `RfqSupplierNotReplyableException`).
  Un fichier qui n'est pas un PDF, un fil bloqué par la plateforme ou une
  demande déclinée entre-temps deviennent une erreur du champ `file` : le
  formulaire garde sa saisie ; en cas d'échec, aucun fichier ne reste. Après un
  dépôt, « Votre réponse » rappelle le devis PDF envoyé.
- `RfqRecipientService#markRespondedByMail` renommé `markRespondedWithQuote` :
  il sert à la réponse par mail comme au dépôt depuis l'écran.
- Helper `formatShortDate` (`shared/helpers/date.ts`), utilisé par les écrans de
  demandes au lieu d'une copie locale de `toLocaleDateString`.
- `SupplierReplyRecordedData.inboundMailId` est désormais `number | null`
  (`null` pour un dépôt depuis l'écran).
- **Anonymisation** (#220) inchangée : agence masquée dans la liste filtrée
  comme dans le détail pour un fournisseur non abonné.
- **i18n** : `rfq.supplier.state.*`, `rfq.supplier.index.{filters,emptyFiltered…}`
  et `quote.supplier.documents.*` dans les 9 langues.
- **Tests** : `tests/functional/supplier_received_requests.spec.ts` (statuts,
  filtres, anonymisation, réponse par mail retrouvée avec son PDF d'origine,
  téléchargement réservé, dépôt : traitement complet, abonné, tardif, non-PDF,
  refus d'accès, fil bloqué, échec sans orphelin), unitaires `supplier_rfq`,
  `pdf_header`, transformers `SupplierRfqTransformer` et
  `SupplierQuoteDocumentTransformer`, Vitest `tests/inertia/supplier_rfqs.spec.ts`.
