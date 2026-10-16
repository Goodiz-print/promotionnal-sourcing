# Cycle de vie de l'organisation : socle backend (PR 1/3)

> Date : 2026-08-20

Premier volet de la gestion du cycle de vie : créer une organisation
supplémentaire, la quitter, l'archiver. **Aucune UI dans cette PR** — routes et
écrans arrivent en PR 2 (sélecteur + création) et PR 3 (quitter/archiver).

- **Archivage réversible** — nouvelle colonne `organizations.archived_at`
  (migration `…968`). Jamais de suppression physique : `suppliers.organization_id`
  étant en `ON DELETE SET NULL`, un DELETE laisserait des fiches et des produits
  orphelins **encore publiés**. La restauration se fait en base (`archived_at` à
  `NULL`), aucun écran ne l'expose.
- **`OrganizationContextService`** (nouveau, sans dépendance) — contexte
  d'organisation de l'utilisateur : `currentFor`, `membershipsFor` (adhésions aux
  organisations vivantes), `fallbackFor`, `reassignCurrentOrganization`,
  `switchTo`, `ensureUsableOrganization`. Séparé d'`OrganizationService` pour
  éviter un cycle d'injection avec `OrganizationMembersService`.
- **`OrganizationService`** gagne `create` (transactionnelle, partagée avec
  l'onboarding qui n'en est plus que l'appelant), `leave` (même invariant
  « dernier owner » que le retrait par un admin) et `archive` (pose `archived_at`
  et **révoque les invitations en attente** — un lien en circulation ne doit pas
  faire rejoindre une organisation hors service).
- **`OnboardedMiddleware` durci** : au-delà de l'absence d'organisation courante,
  il détecte une organisation **archivée** ou une **adhésion disparue**, bascule
  silencieusement sur une autre organisation de l'utilisateur, et ne renvoie vers
  l'onboarding qu'en dernier recours. Même correction dans
  `OrganizationMembersService#removeMember`, qui remettait `currentOrganizationId`
  à `null` sans chercher de repli.
- **Catalogue public** : nouveaux scopes Lucid `Supplier.fromLiveOrganization` et
  `Product.fromLiveOrganization`, appliqués dans `SupplierDirectoryService` et
  `ProductCatalogueService`. Les fiches **sans** organisation (import en masse non
  rattaché, `organization_id` NULL) restent visibles — d'où `whereDoesntHave`
  plutôt qu'une jointure.
- **Acceptation d'invitation** : une invitation vers une organisation archivée
  n'est plus acceptable.
- **Nettoyage** : le helper `currentOrganization(user)` était **dupliqué mot pour
  mot dans 6 controllers**, avec une `Exception` inline `E_NO_CURRENT_ORG`
  contraire aux conventions. Remplacé par `OrganizationContextService#currentFor`
  et 3 vraies classes d'erreur (`NoCurrentOrganizationException`,
  `NotAMemberException`, `OrganizationArchivedException`).
- **Tests** : `tests/functional/organization_lifecycle.spec.ts` (11 tests).
