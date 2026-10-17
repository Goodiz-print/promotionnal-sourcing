# Variantes d'image de la galerie (miniatures)

> Date : 2026-10-17

Cellar ne transformant pas les images à la volée, chaque image de galerie reçoit à l'upload trois variantes WebP générées avec `sharp` : `card` (400 px), `detail` (800 px) et `zoom` (1600 px), sans agrandissement. Un job de queue (`GenerateImageVariantsJob`, via `ImageVariantService`) les produit après le rattachement de l'image au produit, les stocke sur Cellar par `StorageService.storeContent` et les référence dans la nouvelle table `product_image_variants` (migration `create_product_image_variants_table`).

- `ProductImageType.variants` expose les variantes disponibles ; la fiche produit sert `detail` en grand et `card` en miniature, avec repli sur l'original.
- Zéro orphelin : retirer une image ou supprimer un produit libère l'original et ses variantes dans la même transaction.
- Un échec de génération est loggé (3 tentatives) et ne bloque jamais l'enregistrement du produit.
- `StorageDriver` gagne `get(key)` ; le job renseigne aussi `product_images.width`/`height`.
- Tests : `tests/functional/image_variants.spec.ts`, `tests/inertia/products.spec.ts`.
