# Phase 2 (PR 1/4) : fondation données organisations acheteur/fournisseur

> Date : 2026-07-10

Socle **données** de la Phase 2 (#3), non destructif. Introduit le type
d'organisation, le profil fournisseur, et **réconcilie** la table `suppliers`
(catalogue #2, jusqu'ici autonome) avec les `organizations`. Aucune route ni
écran — c'est la première PR du découpage en 4 (PR 2 : CRUD profil + écran
fournisseur ; PR 3 : onboarding acheteur/fournisseur ; PR 4 : annuaire public).

- **Migrations** :
  - `alter_organizations_add_type` : colonne `organization_type` enum(`buyer`,
    `supplier`, `both`), `notNullable`, défaut `buyer`.
  - `alter_suppliers_add_organization_id` : FK `suppliers.organization_id`
    nullable → `organizations` (`onDelete SET NULL`). **Cardinalité hasMany**
    (pas de contrainte unique) : une organisation peut porter plusieurs fiches.
  - `create_supplier_profiles_table` : `organization_id` unique (un profil par
    organisation, `onDelete CASCADE`), `min_order_quantity`, `delivery_days`,
    `delivery_scope` enum(`national`,`europe`,`worldwide`), `certifications`
    (`text[]`, aligné sur `synonyms`), `bio`, `response_time_days`.
- **Modèles** : `SupplierProfile` (`belongsTo(Organization)`) ; `Organization`
  gagne `hasOne(SupplierProfile)`, `hasMany(Supplier)` et l'override
  `organizationType: OrganizationKind` ; `Supplier` gagne `belongsTo(Organization)`.
- **Types partagés** (`shared/types/organization.ts`) : `ORGANIZATION_TYPES` /
  `OrganizationKind` / `DEFAULT_ORGANIZATION_KIND`, `DELIVERY_SCOPES` /
  `DeliveryScope`, champ `organizationType` sur `OrganizationType`, nouvelle
  interface `SupplierProfileType`. (`OrganizationKind` nommé ainsi pour ne pas
  entrer en collision avec l'interface `OrganizationType` existante.)
- **Transformer** : `OrganizationTransformer` expose `organizationType`.
- **Seeders** : `DevUserSeeder` crée une 2ᵉ organisation `eurogoods-org` de type
  `supplier` (dev user en `owner`) + son `SupplierProfile` ; l'org de démo
  passe en `buyer`. `SupplierSeeder` rattache la fiche `eurogoods` à cette
  organisation fournisseur.
- **Schéma généré** : `database/schema.ts` régénéré (Postgres) avec
  `SupplierProfileSchema`, `organizations.organization_type`,
  `suppliers.organization_id`.
- **Tests** : `tests/functional/organization_supplier.spec.ts` (gardé Postgres) —
  type d'org, profil détaillé, rattachement fiche↔org (belongsTo + hasMany),
  sortie du transformer. Suites : pg → 32 passés ; sqlite → 19 passés, 13 sautés.
- **Doc** : `docs/organisations.md` (doc dédiée : modèle de données, relations,
  types, seeders, roadmap 4 PR) + cross-link depuis `docs/catalogue.md`.
