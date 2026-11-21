# Transmission à l'agence de la réponse d'un fournisseur reçue par mail

> Date : 2026-11-21

Issue #225 (suivi #234). Quand un fournisseur répond par mail (#224),
l'agence en est prévenue sans avoir à se connecter.

- **Destinataires** : l'auteur de la demande (`rfqs.created_by_user_id`, #221,
  s'il est encore membre) et les responsables de l'agence (owner, admin,
  manager), sans doublon. Listener `OnSupplierReplyRecorded` sur
  `SupplierReplyRecorded`, service `SupplierReplyNotificationService`.
- **Mail** `supplier-reply-received` (`MAIL_KINDS`, données
  `SupplierReplyReceivedMailData`) : nom du fournisseur, texte de sa réponse,
  un lien de téléchargement par devis PDF, lien vers la demande. Gabarits
  `emails/supplier_reply_received` (HTML) et `_text`, textes
  `emails.supplierReplyReceived.*` dans les 9 langues, envoyé dans la langue de
  chaque destinataire.
- **En-têtes** : expéditeur = la plateforme. `Reply-To` = nouvelle adresse
  relais côté agence `agency-<jeton>@<domaine>` (même jeton que l'adresse
  `rfq-` du fournisseur). Tant que #226 ne la relaie pas, une réponse de
  l'agence est journalisée (`unknown_address`) sans entrer dans le fil ; le mail
  ne propose donc pas encore d'y répondre.
- **Idempotence** : clé `supplier-reply-received:message=<id>:to=<email>`
  (`mail_deliveries`), notification in-app non recréée pour un même message.
- **Notification in-app** `rfq.responded` (type existant, désormais émis), qui
  nomme le fournisseur et mène à la demande ; texte mis à jour dans les 9 langues.
- **Route** `GET /:locale/quote-documents/:id/download`
  (`quote_documents.download`) : sert la version au nom de l'agence (#238) si
  elle existe, sinon l'original, aux seuls membres de l'agence propriétaire
  (ability `canDownloadQuoteDocument`) ; 403 pour tout autre utilisateur, 404
  pour un devis inconnu. Servira aussi à #228. En-tête `Content-Disposition`
  par `attachmentDisposition` (`shared/helpers/http.ts`), nom de fichier nettoyé.
- **Tests** : `tests/functional/supplier_reply_transmission.spec.ts`
  (destinataires, dédoublonnage, idempotence, langue, notification, PDF bandé
  ou d'origine, accès), `tests/unit/mail_templates.spec.ts`,
  `tests/unit/http_helpers.spec.ts`, `tests/unit/inbound_mail_helpers.spec.ts`.
- **Limite connue** : l'émission de `SupplierReplyRecorded` n'est pas garantie
  (arrêt du worker entre le commit et l'émission) ; aucune reprise des
  réponses non transmises n'existe encore.
