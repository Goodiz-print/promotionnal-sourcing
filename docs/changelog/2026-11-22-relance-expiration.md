# Relance et expiration adaptées au parcours par mail

> Date : 2026-11-22

Issue #232. La relance et l'expiration des demandes de devis tiennent compte des
fournisseurs qui répondent par mail, ou qui n'ont pas de compte.

- **Relance sur l'absence de réponse** : `RemindRfqSuppliersJob` relance les
  destinataires renvoyés par `RfqService#remindableRecipients` — statut `sent` ou
  `viewed`, **aucun message côté fournisseur** dans le fil, jamais relancés.
  Ouvrir la demande ne dispense plus de la relance ; avoir répondu par mail (même
  sans devis), décliné ou expiré, si. Le même prédicat sert à la relance manuelle
  de la plateforme et à son compteur. Une fiche sans compte est relancée une fois,
  à l'adresse de l'organisation, avec le même contenu, la même anonymisation et le
  même `Reply-To` relais que la demande.
- **Statut `expired` par destinataire** (`rfq_suppliers.status`) : à l'expiration de
  la demande (`ExpireRfqsJob` ou intervention), les destinataires sans réponse
  passent `expired` dans la même transaction ; leur statut d'avant est gardé dans
  `rfq_suppliers.expired_from` et rendu si l'agence prolonge l'échéance.
- **Réponse tardive** : une réponse par mail arrivée après l'échéance est
  enregistrée (message, devis), et le destinataire passe « répondu » s'il y a un
  PDF, même depuis `expired`. La première est datée dans
  `rfq_suppliers.late_reply_at`. L'événement `SupplierReplyRecorded` porte
  `late` : le mail `supplier-reply-received` à l'agence change d'objet (« Réponse
  tardive de … ») et porte une mention, la notification in-app prend le libellé
  `notifications.late.rfq.responded`, dans les 9 langues.
- **Écrans** : pastilles « Expirée sans réponse » / « Expirée » et « Réponse
  tardive » (`components/rfqs/rfq_recipient_status_badges.vue`) sur la liste des
  destinataires de l'agence et sur la liste et le détail des demandes reçues du
  fournisseur. Champs exposés : `RfqSupplierType.lateReply`,
  `SupplierRfqType.myLateReply`.
- **Migration** `1794000000038_add_expiration_to_rfq_suppliers` : contrainte CHECK
  élargie à `expired`, colonnes `expired_from` et `late_reply_at` ; le `down()` rend
  aux destinataires expirés leur statut d'avant.
- **Indicateurs** : les destinataires expirés comptent parmi les demandes envoyées
  du tableau de bord admin.

Tests : `tests/functional/rfq_expiration.spec.ts` (expiration et restauration des
destinataires, relance des seuls destinataires sans réponse, fiche sans compte,
réponse tardive enregistrée et signalée, écrans), `tests/unit/rfq_deadline.spec.ts`,
`tests/unit/notification_message_key.spec.ts`, `tests/unit/mail_templates.spec.ts`,
`tests/unit/supplier_reply_mail.spec.ts`, specs des transformers
`rfq_supplier_transformer` et `supplier_rfq_transformer`, Vitest `rfqs.spec.ts` et
`supplier_rfqs.spec.ts`.
