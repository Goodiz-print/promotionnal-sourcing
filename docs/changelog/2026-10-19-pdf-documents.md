# Documents PDF des fournisseurs : interfaces (#60)

> Date : 2026-10-19

Dernier volet de #60 : les interfaces au-dessus du backend déjà livré (compression Ghostscript, stockage Cellar, routes).

- **Profil fournisseur** (`/:locale/supplier/profile`) : section « Documents » pour ajouter un PDF (nature : catalogue, certificat ou autre), voir la liste (nom, taille, lien) et retirer un document après confirmation. Le retrait libère le fichier sur Cellar.
- **Fiche publique du fournisseur** (`/:locale/suppliers/:slug`) : section « Documents » avec les liens de téléchargement, visible seulement s'il y a au moins un document.
- **Formulaire d'édition produit** (`/:locale/supplier/products/:id/edit`) : bloc « Fiche technique » sous le formulaire (ajout et retrait). Absent à la création : le produit doit d'abord être enregistré.
- **Fiche produit publique** (`/:locale/products/:slug`) : section « Fiche technique » avec le lien vers le PDF.
- **Props** : `documents` sur les pages `supplier/profile`, `suppliers/show`, `products/show` et `supplier/products/edit` (`id`, `originalName`, `sizeBytes`, `url`, plus `kind` pour les documents d'organisation). Les lignes sans fichier ne sont pas exposées.
- **Composants** : `inertia/components/documents/document_list.vue` (liste) et `document_manager.vue` (ajout/retrait), génériques ; helper `formatFileSize` dans `shared/helpers/file_size.ts`.
- **i18n** : clés `documents.*` ajoutées dans les 9 langues.
- **Tests** : fonctionnels `documents_pages.spec.ts` (props des 4 pages), Vitest `documents.spec.ts` (ajout multipart, retrait, état vide) et fixtures des specs existantes.
- **Dev local** : `brew install ghostscript` (voir `docs/developpement-local.md`). Sans `gs`, le PDF est stocké sans compression.
