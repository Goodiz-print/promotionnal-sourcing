# Sélecteur d'organisation et création d'une organisation supplémentaire (PR 2/3)

> Date : 2026-08-20

Deuxième volet du cycle de vie : l'utilisateur peut créer une organisation
supplémentaire et basculer de l'une à l'autre.

- **Sélecteur affiché uniquement au-delà d'une organisation**
  (`inertia/components/organization/organization_switcher.vue`, dans le header du
  layout). Avec une seule organisation il n'y a rien à choisir — elle est imposée
  par le contexte (onboarding ou acceptation d'invitation) et le contrôle reste
  masqué.
- **Props partagées Inertia** : `organizations` (organisations **vivantes** de
  l'utilisateur, via `OrganizationContextService#membershipsFor` +
  `OrganizationSummaryTransformer`) et `currentOrganizationId`. Une organisation
  archivée disparaît donc du sélecteur. `share()` devient `async` ; la requête
  n'a lieu que pour un utilisateur connecté.
  > `currentOrganizationId` vaut `undefined` et non `null` hors session : le
  > sérialiseur de props refuse une valeur nulle
  > (`Cannot serialize an item with null value`) et fait tomber **toutes** les
  > pages publiques en 500. Même convention que le prop `user`.
- **Routes** `POST organization/switch/:id` (`organization.switch`),
  `GET/POST organization/new` (`organization.create`/`organization.store`), sous
  le middleware `onboarded`, servies par
  `app/controllers/organization/lifecycle_controller.ts`. Basculer sur une
  organisation étrangère ou archivée donne un **flash d'erreur**, pas une page
  d'erreur : le sélecteur peut afficher un état obsolète, ce n'est pas une faute
  de l'utilisateur.
- **Création** : écran `inertia/pages/organization/create.vue`, mêmes champs que
  l'onboarding — extraits en
  `inertia/components/organization/form/organization_form_fields.vue` (partagé
  par les deux écrans, formulaire passé par provide/inject comme les paramètres
  généraux). La création **bascule** sur la nouvelle organisation. Point d'entrée
  dans la nav des paramètres, le sélecteur ne pouvant pas le porter tant qu'on
  n'a qu'une organisation.
- **Tests** : `tests/functional/organization_lifecycle.spec.ts` (+6) et
  `tests/inertia/organization_switcher.spec.ts` (3).
