# Supervision des mails entrants

> Date : 2026-11-20

Écrans admin `/admin/inbound-mail` (#227), voisins de `/admin/mail`, droit `ops.manage` : les réponses des fournisseurs reçues à l'adresse relais, et celles qui n'ont pas pu être rattachées (adresse inconnue ou expirée, réponse automatique, échec du traitement). Détail dans `docs/mail.md`, section « Supervision ».

- **Liste** (`GET /:locale/admin/inbound-mail`, `admin.inbound_mail.index`) : nombre de mails par état, filtres `status` et `rejection`, pagination.
- **Fiche** (`GET /:locale/admin/inbound-mail/:id`, `admin.inbound_mail.show`) : résumé, erreur, corps texte, pièces jointes, et couples demande / fournisseur proposés au rattachement (fournisseurs du domaine de l'expéditeur, ou destinataires de la demande `?rfq=<numéro>`).
- **Rattacher** (`POST …/:id/attach`, champ `rfqSupplierId`) : le mail est rattaché au couple choisi puis traité ; le traitement suit ce rattachement au lieu de l'adresse relais et ne l'écarte plus pour adresse inconnue, expirée ou réponse automatique.
- **Rejouer** (`POST …/:id/replay`) : relance `InboundMailService#process` ; un mail déjà traité ne rejoue que l'enregistrement de la réponse, sans doublon de message ni de `quote_documents`.
- **Écarter** (`POST …/:id/dismiss`) : un mail en attente ou en échec passe `rejected`, nouveau motif `dismissed`.
- Chaque action est tracée dans le journal d'audit : `inbound_mail.attached`, `inbound_mail.replayed`, `inbound_mail.dismissed` (cible `inbound_mail`).
- **Alerte** : quand le job de traitement épuise ses tentatives, `InboundMailProcessingFailed` déclenche un mail `InboundMailFailedAlert` à `MAIL_ALERT_ADDRESS`, une seule fois par mail.
- Migration `inbound_mails` : colonnes `attached_manually_at` et `failure_alerted_at`.
- Onglet « Mails entrants » dans la navigation du back-office ; traductions dans les 9 langues.
- Tests : `tests/functional/admin_inbound_mail.spec.ts` (accès refusé hors admin, filtres, rattachement, rejeu sans doublon, rejet, alerte), `tests/inertia/admin_inbound_mail.spec.ts`.
