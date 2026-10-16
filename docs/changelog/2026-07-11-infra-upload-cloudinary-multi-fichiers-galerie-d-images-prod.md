# Infra : upload Cloudinary multi-fichiers + galerie d'images produit

> Date : 2026-07-11

Pose l'intégration **Cloudinary** (jusque-là inexistante) comme brique d'upload
réutilisable **multi-fichiers**, et l'applique à une **galerie d'images produit**.
(Issue #17.) L'écran d'upload fournisseur suivra avec le CRUD produit (#2).

- **Cloudinary** : dépendance `cloudinary`, `config/cloudinary.ts`, env
  `CLOUDINARY_*` **validées** (`start/env.ts`) + `.env.example`. Service
  `app/services/cloudinary_service.ts` : `upload`/`uploadMany` (galerie) +
  `destroy`/`destroyMany` (nettoyage des assets). **Dossier imposé**
  `promotionnal-sourcing/<environnement>/…` (`NODE_ENV`). Exception
  `app/exceptions/upload_errors.ts` (`CloudinaryUploadException`).
- **Modèle galerie** : migration `create_product_images_table` (`product_id`
  CASCADE, `secure_url`, `public_id` unique, `position`, `width`/`height`) ;
  modèle `product_image.ts` (`Product hasMany images`). `products.image_url`
  conservé comme image principale dénormalisée.
- **Types & transformers** : `ProductImageType` (en `type`), `ProductDetailType.images` ;
  `ProductImageTransformer` ; `ProductDetailTransformer` + `findBySlug` préchargent
  et exposent les images triées par `position`.
- **Validateur multi-fichiers** réutilisable `app/validators/product_image.ts`
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8).
- **Frontend** : `inertia/components/product_gallery.vue` (image principale +
  miniatures, repli sur `imageUrl`) intégré à `products/show.vue` ; clé i18n
  `products.show.viewImage`.
- **Docs** : `CLAUDE.md` (section Cloudinary ; Ghostscript/PDF marqué non implémenté),
  `docs/catalogue.md` (section « Images produit »).
- **Tests** : `tests/unit/cloudinary_service.spec.ts` (uploader mocké, zéro réseau),
  `tests/functional/product_images.spec.ts` (galerie triée via HTTP),
  `tests/inertia/products.spec.ts` (`product_gallery.vue`).
