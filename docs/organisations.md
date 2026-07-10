# Organisations acheteur / fournisseur

Socle de données de la **Phase 2** (#3) : distinguer les organisations
**acheteur** des **fournisseur**, doter les fournisseurs d'un **profil détaillé**
(délais, certifications, périmètre de livraison), et **réconcilier** la table
`suppliers` — créée autonome par le catalogue (#2) — avec les `organizations`.

Décision produit : **un fournisseur = une organisation de type `supplier`,
multi-utilisateurs** (le socle multi-utilisateurs existe déjà via
`organization_users` + rôles owner/admin/manager/member). La fiche catalogue
`suppliers` _appartient_ à une organisation via une FK, plutôt que de fusionner
les deux tables (approche non destructive).

> Ce document couvre la **fondation données** (PR 1/4). Les endpoints, écrans et
> l'onboarding arrivent dans les PR suivantes (voir [Roadmap](#roadmap)).

## Tables

- **`organizations.organization_type`** — enum(`buyer`, `supplier`, `both`),
  `NOT NULL`, défaut `buyer`. Une organisation peut être acheteur, fournisseur,
  ou les deux. Migration `…961_alter_organizations_add_type`.
- **`suppliers.organization_id`** — FK nullable → `organizations`
  (`ON DELETE SET NULL`). **Cardinalité hasMany** : une organisation peut porter
  plusieurs fiches `suppliers` (ex. multi-marques) → **pas** de contrainte unique.
  Nullable pour les ~300 fiches importées avant rattachement (import ops à venir).
  Migration `…962_alter_suppliers_add_organization_id`.
- **`supplier_profiles`** — profil fournisseur au niveau organisation :
  `organization_id` **unique** (`ON DELETE CASCADE` → un profil par organisation),
  `min_order_quantity`, `delivery_days`, `delivery_scope` enum(`national`,
  `europe`, `worldwide`), `certifications text[]` (aligné sur la convention
  `synonyms` du catalogue — pas de jsonb), `bio`, `response_time_days`.
  Migration `…963_create_supplier_profiles_table`.

## Modèles & relations

- **`SupplierProfile`** (`app/models/supplier_profile.ts`) — `belongsTo(Organization)` ;
  override `declare deliveryScope: DeliveryScope | null` et
  `declare certifications: string[] | null` (l'introspection ORM les type
  `string | null` / `any`).
- **`Organization`** — `hasOne(SupplierProfile) supplierProfile`,
  `hasMany(Supplier) suppliers`, override `declare organizationType: OrganizationKind`
  (même pattern que `declare size` déjà présent).
- **`Supplier`** — `belongsTo(Organization) organization` (en plus de
  `hasMany(Product)` / `hasMany(SupplierTranslation)` existants).

## Types partagés (`shared/types/organization.ts`)

- `ORGANIZATION_TYPES` / `OrganizationKind` / `DEFAULT_ORGANIZATION_KIND` —
  pattern const+union, calqué sur `SUPPORTED_LOCALES`/`Locale`
  (`shared/types/i18n.ts`). Réutilisés par la migration (valeurs enum + défaut).
  > Le type union s'appelle **`OrganizationKind`** — et non `OrganizationType` —
  > pour ne pas entrer en collision avec l'interface `OrganizationType` (DTO de
  > l'organisation) déjà exportée par ce fichier.
- `DELIVERY_SCOPES` / `DeliveryScope` — idem pour le périmètre de livraison.
- `OrganizationType` (interface) gagne le champ `organizationType: OrganizationKind`.
- `SupplierProfileType` (nouvelle interface) — forme du profil exposée au frontend
  (`minOrderQuantity`, `deliveryDays`, `deliveryScope`, `certifications`, `bio`,
  `responseTimeDays`).

## Transformer & seeders

- **`OrganizationTransformer`** expose désormais `organizationType`. Le transformer
  `SupplierProfile` et le nesting `supplierProfile` arrivent avec le CRUD (PR 2).
- **`DevUserSeeder`** : l'org de démo passe en `buyer` ; une 2ᵉ organisation
  `eurogoods-org` de type `supplier` est créée (dev user en `owner`) avec son
  `SupplierProfile` (scope `europe`, certifications `ISO 9001`/`FSC`, MOQ 50).
- **`SupplierSeeder`** rattache la fiche catalogue `eurogoods` à l'organisation
  `eurogoods-org` (`suppliers.organization_id`). L'ordre du `MainSeeder`
  (`dev_user` avant `supplier`) garantit que l'organisation existe au rattachement.

## Fichiers clés

| Domaine        | Chemin                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations     | `database/migrations/{…961_alter_organizations_add_type,…962_alter_suppliers_add_organization_id,…963_create_supplier_profiles_table}.ts` |
| Modèles        | `app/models/{organization,supplier,supplier_profile}.ts`                                                                                  |
| Transformer    | `app/transformers/organization_transformer.ts`                                                                                            |
| Types partagés | `shared/types/organization.ts`                                                                                                            |
| Seeders        | `database/seeders/{dev_user,supplier}_seeder.ts`                                                                                          |

## Tests

- `tests/functional/organization_supplier.spec.ts` — type d'org (buyer/supplier),
  profil détaillé (`preload('supplierProfile')`, `certifications` typées),
  rattachement fiche↔organisation (`belongsTo` + `hasMany(suppliers)`), sortie du
  transformer.
- Gardé PostgreSQL (`tests/utils/database.ts` → `isPostgres()`) car il sème via
  `MainSeeder` (qui inclut le catalogue pgvector/tsvector) ; **sauté** sur SQLite.
  Résultat : pg → 32 passés ; sqlite → 19 passés, 13 sautés. Voir `docs/tests.md`.

## Endpoints & écran fournisseur (PR 2)

Un fournisseur édite le profil de son **organisation courante**
(`user.currentOrganizationId`), qui doit être de type `supplier`/`both`.

- **Routes** (préfixe `:locale`, middleware `auth`) :
  - `GET /:locale/supplier/profile` → `supplier.profile` (écran d'édition).
  - `PATCH /:locale/supplier/profile` → `supplier.profile.update` (upsert).
- **Controller** `app/controllers/supplier/profile_controller.ts` (fin) : charge
  l'org courante (`user.load('currentOrganization')`, pas de `Model.query()`),
  autorise via l'ability, délègue au service, répond en **redirection Inertia**
  (flash `success`). 403 si pas d'org courante.
- **Service** `app/services/supplier_profile_service.ts` : `getForOrganization`,
  `upsertForOrganization` (`SupplierProfile.updateOrCreate` sur `organizationId`).
- **Validator** `app/validators/supplier_profile.ts` : tous les champs optionnels
  (`vine.number().min(0)`, `vine.enum(DELIVERY_SCOPES)`, `vine.array(vine.string())`).
- **Ability** `canManageSupplierProfile` (`app/abilities/main.ts`) : org
  `supplier`/`both` **et** membre `owner`/`admin`.
- **Transformer** `supplier_profile_transformer.ts` : retour typé `SupplierProfileType`
  (dates converties en ISO string pour la sérialisation Inertia).
- **Écran** `inertia/pages/supplier/profile.vue` : `useForm` (liste `certifications`
  dynamique), `<select>` périmètre, i18n `resources/lang/{fr,en}/supplier.json`.
  Le DTO `SupplierProfileType` est déclaré en **`type`** (et non `interface`) pour
  satisfaire la contrainte `Record<string, JSONDataTypes>` des props Inertia.
- **Tests** : `tests/functional/supplier_profile.spec.ts` (200 fournisseur, 403
  acheteur, upsert, transformer — Postgres) + `tests/inertia/supplier_profile.spec.ts`
  (rendu, options, pré-remplissage, add/remove certif). `authApiClient` ajouté au
  bootstrap ; alias `#shared` ajouté à `vitest.config.ts`.

## Roadmap

Découpage de la Phase 2 en 4 PR :

1. **PR 1 — Fondation données** — fait : migrations, modèles, types, seeder, tests.
2. **PR 2 — Profil fournisseur** (cette section) — fait : service, validator,
   transformer, controller, routes, ability, écran `supplier/profile.vue`, i18n, tests.
3. **PR 3 — Onboarding** — sélection acheteur/fournisseur au premier login.
4. **PR 4 — Annuaire public fournisseurs** — `suppliers/index.vue` + `show.vue`,
   controller public, transformer enrichi (profil + fiche).

**Hors code (ops)** : import en masse des ~300 fournisseurs (création/rattachement
d'organisations `supplier`, `suppliers.organization_id` renseigné).
