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
  relais côté agence `agency-<jeton agence>@<domaine>`, avec un **jeton propre**
  (`rfq_suppliers.agency_reply_token`, migration `1794000000035`) : l'agence ne
  lit jamais le jeton du fournisseur, qui permettrait d'écrire en son nom dans
  le fil. Tant que #226 ne la relaie pas, une réponse de l'agence est
  journalisée (`unknown_address`) sans entrer dans le fil ; le mail ne propose
  donc pas encore d'y répondre.
- **Idempotence** : clé `supplier-reply-received:message=<id>:to=<email>`
  (`mail_deliveries`) pour le mail ; pour la notification in-app,
  `NotificationService#notifyOnce` (`INSERT … ON CONFLICT DO NOTHING`) sur un
  index unique partiel `notifications (user_id, type, data->>'messageId')`
  (migration `1794000000036`, construite `CONCURRENTLY`, hors transaction), qui
  tient aussi face à deux traitements concurrents.
- **Connexion depuis un lien** : un visiteur sans session était renvoyé vers
  `/login`, qui n'existe pas (404). `AuthMiddleware` renvoie désormais vers
  `/<locale>/login?redirect=<page demandée>` pour une navigation `GET` (visite
  Inertia ou page HTML ; un appel JSON n'est pas repris)
  (`loginPathFor`, `shared/helpers/safe_redirect.ts`) : le lien d'un devis reçu
  par mail mène au PDF une fois connecté. Vaut pour toutes les pages protégées.
  La query string de la page n'est portée que par `redirect=` : le rendu de
  `@adonisjs/auth` la recopiait aussi (`withQs()`), ce qui cassait l'URL de
  connexion. Un appel JSON garde son 401 (`tests/functional/auth_redirect.spec.ts`).
- **Téléchargement** : en-têtes `Cache-Control: private, no-store` et
  `X-Content-Type-Options: nosniff`. Utilitaire `isUniqueViolation`
  (`shared/helpers/database.ts`), désormais partagé par les services.
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
