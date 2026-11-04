# Réordonnancement des catégories (administration)

> Date : 2026-11-04

Fin de l'issue #165 : l'admin plateforme choisit l'ordre d'affichage des catégories.

## Comportement

- Nouvelle colonne `categories.position` (migration `1793900000004_alter_categories_add_position.ts`). La position classe une catégorie **parmi ses sœurs** (même `parent_id`). Les catégories existantes gardent leur ordre actuel (alphabétique par slug) grâce à un renseignement initial.
- `PATCH /:locale/admin/categories/:id/move` (`admin.categories.move`), corps `{ direction: 'up' | 'down' }` : déplace la catégorie d'un cran. Les sœurs sont verrouillées (`FOR UPDATE`) puis renumérotées 0..n-1 (répare aussi les positions en doublon).
- Règle no-op : une catégorie déjà en bout de liste dans le sens demandé ne produit ni écriture ni entrée d'audit.
- Une catégorie créée, ou dont le parent change, passe en fin de liste de ses nouvelles sœurs.
- Liste d'administration : ordre de l'arbre (parcours en profondeur), indentation par niveau, boutons monter/descendre désactivés en bout de liste.
- Catalogue public : le filtre catégorie et les catégories mises en avant sur l'accueil suivent `position` puis slug.
- Audit : action `category.reordered` (ordre des sœurs avant/après, sens).
- i18n : clés `categories.index.moveUp|moveDown`, `categories.flash.moved` et libellé d'audit, dans les 9 langues.
