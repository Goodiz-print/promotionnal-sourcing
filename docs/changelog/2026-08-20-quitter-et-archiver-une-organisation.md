# Quitter et archiver une organisation (PR 3/3)

> Date : 2026-08-20

Dernier volet du cycle de vie : zone de danger dans les paramètres généraux.

- **Routes** `DELETE organization/leave` (`organization.leave`) et
  `POST organization/archive` (`organization.archive`), servies par
  `OrganizationLifecycleController`. L'archivage est gardé par
  `canManageOrganization` (owner + admin) ; le départ n'exige que d'être membre.
- **Départ** — le dernier owner est refusé avec un message explicite (promouvoir
  quelqu'un ou archiver d'abord). Le bouton est **masqué** dans ce cas grâce à
  une nouvelle prop `canLeave` (`OrganizationService#canLeave`), le refus restant
  appliqué côté service. Après le départ, l'utilisateur bascule sur une autre de
  ses organisations ou repart sur l'onboarding.
- **Archivage** — après avoir archivé, l'auteur ne reste pas rattaché à une
  organisation morte : le controller applique tout de suite
  `ensureUsableOrganization`. Les autres membres basculent à leur requête
  suivante, via le middleware.
- **UI** — `inertia/components/organization/settings/danger_zone.vue`, en bas de
  l'écran des paramètres (le composant est extrait pour rester sous les 250
  lignes). `window.confirm` comme pour les autres actions destructives du projet,
  et nouveau variant **`danger`** de `base_button` (tokens `--state-danger`),
  réutilisable ailleurs.
- ⚠️ **Limite connue** : l'écran des paramètres est réservé aux owner/admin
  (`canManageOrganization`), donc un membre simple ne dispose d'aucun écran d'où
  quitter l'organisation — la route existe et l'autorise, mais aucune UI ne la
  lui expose. Un écran « mes organisations » accessible à tout membre reste à
  faire.
- **Tests** : `tests/functional/organization_lifecycle.spec.ts` (+5) et
  `tests/inertia/organization_danger_zone.spec.ts` (4).
