# Bascule sur l'organisation rejointe à l'acceptation d'une invitation (#32)

> Date : 2026-08-20

Accepter une invitation change désormais l'organisation courante, sans condition.

- **`OrganizationInvitationsService#accept()`** fixait `currentOrganizationId`
  **uniquement s'il était vide** : un invité déjà membre d'une organisation
  voyait son adhésion créée en base mais restait sur l'ancienne, sans aucun
  écran ni route pour atteindre celle qu'il venait de rejoindre — l'invitation
  semblait sans effet. La bascule est maintenant systématique.
- **Multi-organisation conservé** : l'adhésion précédente reste intacte (un
  contact peut travailler pour un acheteur _et_ un fournisseur). Basculer n'est
  pas quitter — l'utilisateur revient sur l'ancienne via le sélecteur
  d'organisation, qui devient justement visible puisqu'il a deux adhésions.
- **Flash nommé** : `organization.invitations.accept.success` prend un paramètre
  `{organization}` (« Vous avez rejoint Acme. » / « You've joined Acme. ») pour
  que la bascule soit lisible plutôt que subie. Clés FR/EN mises à jour.
- **Écrans** : aucun changement nécessaire — `organizations` et
  `currentOrganizationId` sont des props partagées `inertia.always(...)`,
  recalculées à la redirection qui suit l'acceptation.
- **Tests** : `tests/functional/organization_invitation_acceptance.spec.ts` (+1 —
  un membre d'Acme accepte une invitation pour Beta : courante = Beta, flash
  nommant Beta, les deux adhésions conservées).
- **Doc** : `docs/organisations.md` § « Bascule sur l'organisation rejointe à
  l'acceptation ».
