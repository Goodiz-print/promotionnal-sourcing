# Expiration, prolongation et relance des demandes de devis (#56)

> Date : 2026-10-24

- **Statut `expired`** : une demande publiée dont l'échéance est dépassée passe en
  `expired` (`rfqs.expired_at`). L'échéance est une date : la demande est échue le
  lendemain à 00:00, heure de Paris. Les destinataires gardent leur statut, le
  fournisseur voit la demande avec la mention « échue » et ne peut plus la
  décliner. Un brouillon, une demande close ou sans échéance n'expirent jamais.
- **Job `ExpireRfqsJob`** : quotidien, 00:10 (Europe/Paris), `RfqService#expireDue`.
- **Prolonger l'échéance** : `PATCH /:locale/rfqs/:id/deadline`
  (`rfqs.deadline.update`) sur une demande publiée ou échue. Seule `deadline`
  change (exception assumée à « seul un brouillon est modifiable ») ; la nouvelle
  date doit être future et postérieure à l'actuelle. Sur une demande échue, elle la
  rouvre.
- **Relance** : `RemindRfqSuppliersJob`, quotidien, 09:00 (Europe/Paris). Un
  destinataire `sent` (jamais ouvert) depuis `RFQ_REMINDER_AFTER_DAYS` (3) jours
  reçoit **une seule** relance (`rfq_suppliers.reminded_at`), par mail
  `rfq-reminder`, dans sa langue.
- **Interface** : pastille « Échue », compteur « Échues » sur le tableau de bord de
  l'acheteur, bouton « Prolonger l'échéance » ; libellés dans les 9 langues.
- Migration `alter_rfqs_add_expiration_and_reminders` (contrainte de statut élargie,
  `rfqs.expired_at`, `rfq_suppliers.reminded_at`).
- Tests : `tests/functional/rfq_expiration.spec.ts`,
  `tests/inertia/rfq_deadline_extension.spec.ts`.
