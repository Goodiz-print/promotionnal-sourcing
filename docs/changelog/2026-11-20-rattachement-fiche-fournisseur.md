# Rattachement d'une fiche fournisseur importée à son organisation

> Date : 2026-11-20

Issue #231. Le rattachement d'une fiche `suppliers` importée par un connecteur à
l'organisation du fournisseur devient l'acte, validé par un admin, qui enregistre
l'accord du fournisseur et publie son catalogue.

- **Écran back-office** `/:locale/admin/supplier-links` (`admin.supplier_links.index`,
  droit `organizations.manage`, onglet « Rattachement fournisseurs ») : fiches en
  attente d'accord (sans organisation) ou rattachées ; nombre de produits ;
  organisation proposée et choix de l'organisation ; date et auteur de l'accord.
- **Proposition automatique** : même email que l'organisation ou qu'un de ses
  membres, sinon même domaine (email ou site web, sous-domaines compris) ; les
  domaines de messagerie grand public sont ignorés.
- **Rattacher** `POST /:locale/admin/supplier-links/:id/link` (`organizationId`,
  `admin.supplier_links.link`) : une seule organisation par fiche (une fiche déjà
  rattachée est refusée), organisation fournisseur non archivée obligatoire.
- **Détacher** `DELETE /:locale/admin/supplier-links/:id/link`
  (`admin.supplier_links.unlink`), après confirmation.
- **Migration** : `suppliers.linked_at` et `suppliers.linked_by_user_id` (FK
  `users`, `SET NULL`), index partiel des fiches sans organisation.
- **Audit** : actions `supplier.linked` / `supplier.unlinked`, cible `supplier`,
  dans la transaction du rattachement.
- **Recherche** : `IndexSupplierProductsJob` (via `SearchSyncService.queueSupplier`)
  réindexe les produits de la fiche après rattachement ou détachement.
- Le masquage public des fiches sans organisation reste l'objet de #240.
- Libellés dans les 9 langues ; tests fonctionnels (`admin_supplier_links.spec.ts`)
  et unitaires (`supplier_link_suggestion.spec.ts`).
