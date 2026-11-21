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

Téléchargement d'un devis PDF reçu par mail (#225) :
`GET /:locale/quote-documents/:id/download` (`quote_documents.download`,
`QuoteDocumentsController#download`). Réservé aux **membres de l'agence**
propriétaire de la demande, quel que soit leur rôle (ability
`canDownloadQuoteDocument`) : un autre utilisateur — fournisseur compris — reçoit
un **403**, un devis inconnu un 404, un visiteur est renvoyé vers la connexion
puis ramené au devis (`?redirect=`).
La route sert `QuoteDocument#recipientFile` (version au nom de l'agence pour un
non-abonné, sinon l'original) en passant par l'application
(`Cache-Control: private, no-store`) : l'URL de stockage n'est jamais exposée.
C'est le lien des mails transmis à l'agence ; l'écran de la demande (#228) le
réutilisera.

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

## Devis reçu par mail, en PDF (#224)

Un fournisseur répond aussi à la demande **depuis sa messagerie**, en joignant le
PDF produit par son propre logiciel ([`mail.md`](mail.md), « Mails entrants »). Ce
devis PDF **coexiste** avec le devis structuré ci-dessus : aucun des deux ne
remplace l'autre, et un devis PDF n'a ni lignes, ni montant, ni statut.

`InboundMailReceived` → `OnInboundMailReceived` → `SupplierReplyService#record` :

1. le mail devient un **message** du fil de la demande pour ce destinataire
   (`ConversationService#threadForRecipient`, `#recordInbound`) — voir
   [`entites-transverses.md`](entites-transverses.md) ;
2. ses pièces jointes acceptées deviennent celles du message
   (`message_attachments`) ; un **PDF est compressé** par `PdfService` avant
   d'être rattaché ([`storage.md`](storage.md)) ;
3. chaque PDF est enregistré comme **devis du fournisseur** (`quote_documents`,
   `QuoteService#recordDocuments`), avec, pour un fournisseur non abonné, sa
   **version destinataire** au nom de l'agence (#238, ci-dessous) ;
4. s'il y a au moins un PDF, le destinataire passe `responded`
   (`RfqService#markRespondedByMail`).

| Table             | Colonnes notables                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quote_documents` | `rfq_id`, `rfq_supplier_id`, `message_id`, `message_attachment_id` (unique), `received_at`, `recipient_storage_object_id` (nullable), `stamped_at` |

- **Rattaché au destinataire** (`rfq_suppliers`), pas à l'organisation ni à un
  utilisateur : le message n'a pas d'auteur (`author_user_id` nul), l'expéditeur
  est celui du mail. Rien ne suppose un compte ou un membre côté fournisseur
  (#218). Reste à faire quand #218 rendra `rfq_suppliers.supplier_organization_id`
  facultative : rendre `conversations.supplier_organization_id` facultative de même.
- **Plusieurs devis successifs** : chaque réponse ajoute ses PDF, rien n'est
  écrasé. `QuoteService#currentDocumentsFor(rfqSupplierId)` renvoie ceux qui
  **font foi** (les PDF de la dernière réponse qui en porte),
  `#documentsFor(rfqSupplierId)` tous, du plus récent au plus ancien.
- **Tout PDF joint vaut devis** : la plateforme ne lit pas le contenu, elle ne
  distingue pas un devis d'un catalogue joint au même mail.
- **Sans PDF** (texte seul, ou pièce d'un autre format) : simple message, le
  statut ne change pas.
- **Statut** : `sent`/`viewed` → `responded`, par un `UPDATE` conditionnel. Un
  destinataire `declined` ou déjà `responded` le reste. Si la demande n'attend
  plus de réponse (close, expirée, échéance passée) mais que l'adresse relais est
  encore valide (délai de grâce), le message et le devis sont enregistrés sans
  toucher au statut.
- **Corps du message** : la partie texte du mail, à défaut son HTML réduit à du
  texte (`htmlToText`), borné à `MESSAGE_MAX_LENGTH`. Le mail complet reste dans
  `inbound_mails`. `htmlToText` ne lève jamais et travaille en temps linéaire sur
  au plus `HTML_TEXT_SOURCE_MAX` caractères : le HTML vient d'un tiers.
- **Mail sans rien à lire** (ni texte, ni fichier conservé — pièces toutes
  refusées, par exemple) : aucun message n'est créé, le mail reste dans le journal.
- **Expéditeur** : le jeton de l'adresse relais fait foi, pas l'expéditeur
  ([`mail.md`](mail.md)). Un écran qui affiche ces messages (#226) doit montrer
  l'expéditeur et s'il est connu : `message.inboundMail` (`senderName`,
  `senderAddress`, `senderKnown`).
- **Idempotence** : `messages.inbound_mail_id` est unique ; un mail rejoué ne
  crée ni second message ni second devis.
- **Atomicité** : message, pièces jointes, devis et statut sont écrits dans une
  seule transaction, sous verrou de la ligne destinataire (un seul fil par
  destinataire, même pour deux réponses simultanées). En cas d'échec rien n'est
  écrit, les PDF compressés sont libérés (`StorageService.discard`), le mail
  repasse `failed` et son traitement est rejoué.
- **Événement** : `SupplierReplyRecorded` (`inboundMailId`, `rfqSupplierId`,
  `conversationId`, `messageId`, `quoteDocumentIds`, `responded`), émis une fois
  par mail après le commit — le point d'accroche de la transmission à l'agence
  (#225). Un écouteur défaillant est loggué sans faire rejouer le mail.
  **L'émission n'est pas garantie** : si le worker s'arrête entre le commit et
  l'émission, l'événement est perdu et rien ne le rejoue (le mail est déjà
  enregistré). #225 ne doit donc pas dépendre de ce seul événement pour
  transmettre la réponse : prévoir une reprise sur les messages portant
  `inbound_mail_id` sans envoi correspondant dans `mail_deliveries`.

### Transmission à l'agence (#225)

`SupplierReplyRecorded` → `OnSupplierReplyRecorded` →
`SupplierReplyNotificationService#notify` :

- **Destinataires** : l'auteur de la demande (`rfqs.created_by_user_id`, s'il
  est encore membre de l'agence) et les responsables de l'agence
  (`RFQ_MANAGER_ROLES`), une seule fois chacun.
- **Mail** `supplier-reply-received`, dans la langue de chacun : nom du
  fournisseur (l'agence le connaît), texte de la réponse, un **lien de
  téléchargement authentifié** par devis PDF (`quote_documents.download`), lien
  vers la demande. Expéditeur : la plateforme ; `Reply-To` : l'adresse relais
  côté agence (voir `docs/mail.md`, branchée par #226).
- **Notification in-app** `rfq.responded` (`InAppNotificationService#supplierReplied`),
  données `rfqId`, `rfqTitle`, `supplierName`, `messageId` ; elle mène à la demande.
- **Idempotence** : la clé du mail porte le message du fil et le destinataire
  (`mail_deliveries`) ; la notification passe par
  `NotificationService#notifyOncePerMessage` (`INSERT … ON CONFLICT DO NOTHING` sur
  l'index unique partiel `notifications (user_id, type, data->>'messageId')`).
  Un événement rejoué, même en concurrence, ne prévient personne deux fois, et
  un doublon ne lève jamais d'erreur.
- **Devis cités** : `QuoteService#documentsOfReply`, limité aux devis de cette
  réponse et de ce destinataire.
- **Limite** : la transmission dépend de l'événement, dont l'émission n'est pas
  garantie (voir ci-dessus). La reprise des réponses non transmises reste à faire.

Aucun écran n'affiche encore ces devis (#228) ; le fil d'échanges relève de #226.

### Version destinataire : le nom de l'agence sur le devis (#238)

Un fournisseur non abonné établit son devis sans connaître l'agence (#220) :
son PDF n'en porte pas le nom. La plateforme produit donc une **copie
destinataire** qui l'ajoute :

- **Quand** : à l'enregistrement de la réponse, si l'organisation du
  fournisseur n'est **pas abonnée à ce moment-là**
  (`SubscriptionService#isSubscribed`). Un abonné connaît l'agence (#221) : son
  devis n'est pas modifié.
- **Quoi** : « Devis établi pour : <nom de l'agence> — demande n° <id> »,
  dans un **bandeau en tête de la première page** (`PdfService#stampRecipient`,
  `pdf-lib`). La page est **agrandie** vers le haut de la hauteur du bandeau :
  le contenu d'origine n'est ni déplacé ni masqué. Repli sur une **page de
  garde** A4 insérée avant le devis quand la première page est pivotée ou déjà
  à la taille maximale d'une page PDF. Un nom trop long est réduit puis
  tronqué.
- **Repli sans modification** : un PDF chiffré, signé (champ de signature
  rempli : la modifier l'invaliderait ; un emplacement de signature vide
  n'empêche rien) ou illisible, ou un nom d'agence que la police standard
  (Latin, WinAnsi) ne sait pas écrire — cyrillique, grec, idéogrammes… : un
  bandeau amputé du nom laisserait croire l'agence nommée —, est transmis
  **tel quel**, avec un warning loggé (`rfqId`, `rfqSupplierId`,
  `inboundAttachmentId`, raison). Jamais d'erreur : `recipient_storage_object_id` reste nul.
  Le nom de l'agence figure alors dans le mail de transmission (#225).
- **Stockage** : la copie est stockée par `StorageService.storeContent` avant
  la transaction, puis référencée par `quote_documents.recipient_storage_object_id`
  dans la transaction qui écrit le devis ; `stamped_at` date l'apposition. Si
  la transaction échoue, la copie est libérée comme les PDF compressés.
- **Qui voit quoi** : le message du fil (`message_attachments`) garde le PDF
  d'origine, le seul que voit le fournisseur. L'agence reçoit
  `QuoteDocument#recipientFile` — la copie si elle existe, sinon l'original
  (relations chargées par `QuoteService#documentsFor`). C'est ce fichier que
  #225 transmet et que #228 propose au téléchargement.
- **Coût** : `pdf-lib` analyse tout le fichier dans le worker. Les pièces
  jointes sont bornées à 15 Mo (`INBOUND_MAIL_MAX_ATTACHMENT_SIZE_MB`) ; un
  PDF malformé très lent ralentirait la file sans la bloquer en erreur.

## Tests

`tests/functional/supplier_replies.spec.ts` (réponse par mail : message, pièce
jointe compressée, devis PDF, statut, devis successifs, rejeu, échec sans
orphelin), `tests/functional/supplier_reply_recipient_version.spec.ts` (version
destinataire : non abonné, abonné, PDF signé, échec sans orphelin),
`tests/unit/pdf_service.spec.ts` (bandeau, multipages, page de garde, PDF
chiffré, signé ou illisible). `tests/functional/quotes.spec.ts` (service et écrans), `tests/inertia/*` pour les
props de `supplier/rfqs/show.vue` et `rfqs/show.vue`.
