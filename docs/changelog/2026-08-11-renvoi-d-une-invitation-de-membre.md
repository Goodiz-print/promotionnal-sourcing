# Renvoi d'une invitation de membre

> Date : 2026-08-11

Complète les invitations par email : un owner/admin/manager peut **renvoyer** le
mail d'une invitation restée en attente (non reçue, lien expiré) depuis la liste
des invitations, sans en créer une seconde ni ressaisir l'email.

- **Route** `POST organization/invitations/:id/resend`
  (`organization.invitations.resend`), ability `canInviteMembers` — la même que
  l'envoi et la révocation.
- **Service** `OrganizationInvitationsService#resend` : prolonge `expires_at`
  d'un nouveau TTL (7 jours), précharge `role`/`invitedBy`, et laisse
  `invited_by_user_id` **inchangé** (renvoyer ≠ réinviter : le mail continue
  d'annoncer l'auteur d'origine). Une invitation `accepted`/`revoked` est
  refusée → `InvitationNotPendingException` (422,
  `app/exceptions/organization_errors.ts`), interceptée dans le controller →
  flash `error` + redirection, jamais de page d'erreur générique.
- **Lien** : nouveau lien signé (`signedUrlFor`, `expiresIn: '7d'`). Aucun token
  n'étant stocké en base, le lien précédent reste valide jusqu'à sa propre
  échéance ; la révocation demeure le moyen d'invalider immédiatement un lien en
  circulation (le statut est vérifié à l'acceptation).
- **Controller** : chargement de l'invitation factorisé en
  `findInOrganization(id, organizationId)`, partagé avec `destroy` — un id
  d'une autre organisation renvoie **404** (pas de fuite d'existence).
- **Écran** : bouton « Renvoyer » par ligne dans `pending_invitations.vue`
  (`router.post`, `preserveScroll`, sans `window.confirm` — action non
  destructive, contrairement à la révocation). i18n FR/EN
  `organization.invitations.{resend,resent,notPending}`.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+4 :
  prolongation de l'expiration et mail remis en file sans doublon, invitation
  révoquée refusée, invitation d'une autre organisation en 404, membre simple
  bloqué) et `tests/inertia/organization_members.spec.ts` (+1). Docs
  `docs/organisations.md`.
