# Équipe commerciale des fournisseurs, affichée aux agences selon leur pays

> Date : 2026-11-20

Issue #241. Les contacts d'un fournisseur sont son équipe commerciale : une
agence ne voit que les commerciaux qui couvrent son pays, et seulement si le
fournisseur est abonné.

**Donnée** (migration `1794000000029_add_countries_and_member_to_supplier_contacts`, avec `down()`)

- `supplier_contacts.countries` (`text[]`, codes ISO alpha-2, vide = tous les
  pays) remplace le texte libre `coverage`, que rien n'écrivait.
- `supplier_contacts.user_id` (facultatif, `SET NULL`) : le contact est aussi un
  membre du compte fournisseur. Le validateur refuse un utilisateur qui n'est pas
  membre de l'organisation.
- `supplier_profiles.show_all_contacts` (défaut `false`) : « montrer toute
  l'équipe à toutes les agences ».

**Espace fournisseur** — écran « Équipe commerciale » (owner/admin, droit
`canManageSupplierProfile`), entrée de menu dédiée :

- `GET /:locale/supplier/contacts` (`supplier.contacts.index`) ;
- `POST /:locale/supplier/contacts` (`supplier.contacts.store`) ;
- `PATCH /:locale/supplier/contacts/:id` (`supplier.contacts.update`) ;
- `DELETE /:locale/supplier/contacts/:id` (`supplier.contacts.destroy`) ;
- `POST /:locale/supplier/contacts/:id/move` (`supplier.contacts.move`, `direction: up | down`) ;
- `PATCH /:locale/supplier/contacts/settings` (`supplier.contacts.settings`, `showAllContacts`).

Un fournisseur gratuit prépare son équipe ; un encart lui rappelle que les
contacts ne sont montrés qu'aux abonnés, avec un lien vers la page abonnement.

**Côté agence** — règle unique dans `SupplierContactService.visibleFor`, évaluée à
la lecture :

1. visiteur non connecté, ou fournisseur non abonné : aucun contact ;
2. option « toute l'équipe » activée : tous les contacts ;
3. sinon les contacts qui couvrent le pays de l'organisation courante (ou tous les pays) ;
4. si aucun ne correspond : toute l'équipe (repli).

Les contacts écartés ne sont pas envoyés au navigateur. Ils apparaissent sur la
page publique du fournisseur (prop `contacts`) et sur le détail d'une demande
dans « Mes demandes » (prop `supplierContacts`, par organisation destinataire).
Les demandes de devis partent toujours à l'adresse de réception générale.

**Composants** : `BaseTagPicker` (sélection multiple en badges, pays et
langues), `SupplierContactSummary` / `SupplierContactCards`, composable
`useRegionOptions` (noms de pays et de langues via `Intl.DisplayNames`).

**Tests** : `tests/functional/supplier_contacts.spec.ts` (règle pour chaque cas,
gestion par le fournisseur, props Inertia de la page fournisseur et du détail de
demande), `tests/inertia/suppliers.spec.ts`. Nouvelle factory
`OrganizationSubscriptionFactory`.
