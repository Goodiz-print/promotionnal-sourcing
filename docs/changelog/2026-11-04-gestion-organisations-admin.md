# Gestion des organisations (admin plateforme)

Date : 2026-11-04  
Issue : #161

## Fonctionnalites

### Liste enrichie

- Recherche partielle sur nom, slug, SIRET ou TVA (insensible a la casse, jokers LIKE echappes).
- Filtre par pays (code ISO 2 lettres).
- Validation VineJS des filtres et de la page (valeur invalide → 422).
- Prop `filterOptions` avec types et pays distincts pour les selecteurs frontend.

### Fiche detaillee

- Informations completes : nom, slug, type, pays, email, telephone, site, SIRET, TVA, secteur, taille, description, adresse, logo, dates, plan d'abonnement, locale.
- Membres avec `membershipId` (necessaire aux actions).
- Invitations en attente avec email inviteur.
- Profils : fournisseur, agence (avec `reviewReasons`, `vat_verified_at`, `domain_verified_at`), facturation (`stripeCustomerId` omis).
- Volumes : produits et demandes de devis.
- Derniere activite (derniere connexion d'un membre).
- Flag `canManage` selon le droit.

### Actions (droit `organizations.manage`, admin seul)

| Action                      | Route                                                            | Audit                              |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| Archiver                    | `POST /admin/organizations/:id/archive`                          | `organization.archived`            |
| Restaurer                   | `POST /admin/organizations/:id/restore`                          | `organization.restored`            |
| Modifier les informations   | `PATCH /admin/organizations/:id`                                 | `organization.updated`             |
| Changer le type             | `PATCH /admin/organizations/:id/type`                            | `organization.type_changed`        |
| Changer le role d'un membre | `PATCH /admin/organizations/:id/members/:membershipId/role`      | `organization.member_role_changed` |
| Retirer un membre           | `DELETE /admin/organizations/:id/members/:membershipId`          | `organization.member_removed`      |
| Revoquer une invitation     | `DELETE /admin/organizations/:id/invitations/:invitationId`      | `organization.invitation_revoked`  |
| Renvoyer une invitation     | `POST /admin/organizations/:id/invitations/:invitationId/resend` | `organization.invitation_resent`   |

Chaque action :

- repond par redirection + flash (jamais de JSON),
- ecrit son audit dans la meme transaction,
- verrouille l'organisation (`FOR UPDATE`) pour serialiser les modifications concurrentes.

### Invariants

- Archiver deja archivee / restaurer active → 409, pas d'audit.
- Archiver revoque les invitations en attente et emet `OrganizationCatalogueChanged`.
- Restaurer emet aussi `OrganizationCatalogueChanged`.
- Modification sans changement → pas d'audit.
- Changement de type vers `buyer` refuse si produits ou profil fournisseur (409).
- Retrait / retrogradation du dernier owner refuse (409).
- Le membre retire bascule d'organisation courante si necessaire.
- Une organisation archivee reste modifiable.

## Fichiers crees

- `shared/types/admin_organization.ts` — DTO de la liste et de la fiche
- `app/validators/admin_organization.ts` — validation des filtres et actions
- `app/exceptions/admin_organization_errors.ts` — exceptions metier
- `app/services/admin_organization_action_service.ts` — actions d'ecriture
- `app/controllers/admin/organization_management_controller.ts` — actions

## Fichiers modifies

- `shared/types/user.ts` — permission `organizations.manage`
- `shared/types/admin_audit.ts` — nouvelles actions d'audit
- `app/services/admin_organization_service.ts` — recherche, filtres, fiche enrichie
- `app/controllers/admin/organization_controller.ts` — validation des filtres
- `app/transformers/admin_organization_transformer.ts` — `lastActivity`
- `app/transformers/admin_organization_detail_transformer.ts` — DTO complet
- `start/routes.ts` — routes des actions
- `tests/unit/platform_permissions.spec.ts` — test du nouveau droit
- `tests/functional/admin_organizations.spec.ts` — tests etendus
- `resources/lang/*/admin.json` — traductions (9 langues)
- `docs/admin.md` — documentation

## Cles i18n utilisables par le frontend

### Filtres (admin.organizations.filters.*)

- `search`, `searchPlaceholder`, `country`, `allCountries`

### Actions (admin.organizations.actions.*)

- `archive.*`, `restore.*`, `update.*`, `changeType.*`, `member.*`, `invitation.*`

### Audit (admin.audit.actions.*)

- `organization.archived`, `organization.restored`, `organization.updated`, `organization.type_changed`, `organization.member_role_changed`, `organization.member_removed`, `organization.invitation_revoked`, `organization.invitation_resent`
