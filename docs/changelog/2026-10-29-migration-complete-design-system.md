# Migration complète de l'application sur le design system

> Date : 2026-10-29

Suite de `2026-10-29-design-system-applicatif.md` : plus aucune trace de l'ancien design dans `inertia/`.

## Pages et composants migrés

- **Admin** : catégories (liste, création, édition), organisations (liste, fiche), utilisateurs — `BasePageHeader`, onglets `BaseTabs`, filtres en `BaseCard`, tableaux `BaseTable`, fiches en `BaseSection` + `BaseDescriptionList`.
- **Espace fournisseur** : mes produits (tableau avec vignettes et statuts), demandes reçues (liste et fiche), devis (liste, formulaire en `BaseSection as="fieldset"`, lignes `BaseTable`), commandes reçues, profil fournisseur (sections + barre d'actions collante).
- **Acheteur** : fiche produit découpée en sous-composants (`inertia/components/products/show/`), galerie, sélecteur de variantes, paliers de prix, fiche fournisseur, fiche devis, commandes (liste, détail, lignes, chronologie, adresse), création de demande de devis (formulaire, lignes, sélecteurs produit / fournisseur), notifications.
- **Compte et organisation** : compte (profil, mot de passe, passkeys), membres (tableau, invitations), paramètres (général, adresse, logo via `BaseFileInput`), zones de danger sur `BaseDangerZone` ; `components/organization/section_nav.vue` remplacé par `BaseTabs` + `composables/use_organization_tabs.ts`.

## Nouveaux composants

`BaseDangerZone` (actions irréversibles), `BaseDescriptionList` + `BaseDescriptionItem` (listes clé / valeur des fiches), `AuthHeader` (en-tête des écrans d'authentification, remplace dix `<h1>` copiés).

## Corrections au passage

- `resources/lang/{fr,en}/categories.json` : la clé `edit` était déclarée deux fois (objet puis chaîne), si bien que le titre de la page d'édition n'a jamais résolu ; le titre vit désormais sous `categories.update.*`.
- Flèche texte retirée de `admin.organizations.back` (l'icône est dans `BasePageHeader`).

## Suppression des alias legacy

- `inertia/css/tokens/colors.css` : plus de `--gray-*`, `--primary-*`, `--primary-contrast`, `--color-primary*` ni de tokens `--btn-*` inutilisés ; `inertia/css/app.css` : plus d'utilitaires `bg-primary`, `text-primary-*`… Toute couleur passe par `indigo-*`, `ink-*` ou les tokens sémantiques.
- `inertia/app.ts` : barre de progression Inertia en indigo de marque.

## Garde-fou

`tests/inertia/design_system_guard.spec.ts` échoue (donc la CI aussi) si un fichier de `inertia/` (hors landing et CSS) réintroduit une trace de l'ancien design : alias legacy, `text-[NNpx]`, `tracking-[…]`, `rounded` nu, couleur hex, `<details>`, `shadow-lg`, glyphe texte ou taille Tailwind générique (`text-sm`, `text-lg`…) au lieu de l'échelle du design system.

Documentation : `docs/design-system.md` (composants, garde-fou), `docs/charte-graphique.md` (plus d'alias).
