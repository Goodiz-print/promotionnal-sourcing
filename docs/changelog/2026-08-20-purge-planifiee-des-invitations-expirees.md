# Purge planifiée des invitations expirées

> Date : 2026-08-20

Les invitations d'organisation en attente restaient `pending` indéfiniment une
fois leur échéance passée : inacceptables côté acceptation, mais toujours
listées comme en attente. Un job quotidien fait le ménage.

- **Statut `expired`** ajouté à `INVITATION_STATUSES`
  (`shared/types/organization.ts`) et à la contrainte CHECK de
  `organization_invitations.status` (migration
  `…967_alter_organization_invitations_add_expired_status`, SQL brut : knex ne
  sait pas étendre l'énumération d'une colonne existante ; le `down()` remet les
  lignes `expired` en `pending`). Statut posé par la purge uniquement, jamais
  par une action utilisateur.
- **Service** `OrganizationInvitationsService#purgeExpired(now?)` → `{ expired,
deleted }` : bascule en `expired` les invitations `pending` échues (elles
  sortent de `listPending`, donc de l'écran membres), puis **supprime** les
  invitations en état terminal (`expired`/`revoked`) créées il y a plus de
  90 jours. Les invitations `accepted` ne sont jamais supprimées — elles tracent
  l'origine d'une adhésion active. `now` paramétrable pour tester la rétention.
- **Job** `app/jobs/purge_expired_invitations_job.ts` planifié dans
  `start/scheduler.ts` (cron `15 3 * * *` → tous les jours à **03:15 Europe/Paris**, id
  `purge-expired-invitations` pour une planification idempotente). Le service y
  est importé dynamiquement dans `execute()` : la queue charge les jobs au boot
  et ce service importe des modèles Lucid (même contrainte que
  `GenerateProductEmbeddingJob`).
- **Effet de bord assumé** : une invitation basculée `expired` n'est plus
  renvoyable (`resend` exige `pending`) — il faut ré-inviter l'email, sans
  risque de doublon. Avant passage du job, le bouton « Renvoyer » fonctionne
  comme avant.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+3). Docs
  `docs/organisations.md`.
