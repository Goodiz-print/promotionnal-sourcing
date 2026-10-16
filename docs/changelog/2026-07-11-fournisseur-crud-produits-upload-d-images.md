# Fournisseur : CRUD produits + upload d'images (Phase 1)

> Date : 2026-07-11

Donne au fournisseur l'écran authentifié pour créer / éditer / supprimer ses
produits, avec upload multi-images branché sur Cloudinary. Consomme l'infra #17
et fait avancer #2.

- **Routes** (`:locale`, `auth` + `onboarded`) : `supplier.products.index/create/store/edit/update/destroy`
  (`update` en **POST** pour porter le multipart).
- **Ability** `canManageProducts` (org `supplier`/`both` + `owner`/`admin`).
- **Service** `supplier_product_service.ts` : `resolveSupplier` (**get-or-create** du
  fournisseur de l'org), `create`/`update`/`delete`, slug unique, traductions par locale,
  facettes en ET fiable (`attributeValues.sync`), galerie (upload/suppression Cloudinary,
  `image_url` recalé). `CloudinaryService` injecté (testable). `findOwned` garantit l'ownership.
- **Validateur** `supplier_product.ts` (contenu bilingue requis, facettes, `vine.file` multi,
  `removedImageIds`). **Transformer** `product_edit_transformer.ts` (`ProductEditType`).
- **Frontend** : pages `supplier/products/{index,create,edit}` + formulaire partagé
  `products/form/product_form.vue` (sections reliées par provide/inject) + composant
  générique `base_file_input.vue` ; i18n `products.manage.*`.
- **Tests** : `supplier_products.spec.ts` (CRUD, ownership 404, acheteur 403, publication
  au catalogue), `supplier_product_images.spec.ts` (galerie + get-or-create, Cloudinary
  mocké), `tests/inertia/supplier_products.spec.ts` (liste, file input, facettes).
- **Docs** : `docs/catalogue.md` (section « Gestion produit fournisseur »).
