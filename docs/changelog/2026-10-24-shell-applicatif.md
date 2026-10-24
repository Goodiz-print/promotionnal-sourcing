# Coquille applicative : menu, tableau de bord et accueil (#43)

> Date : 2026-10-24

L'application se parcourt désormais sans connaître les URL.

## Menu applicatif

- Prop Inertia partagée **`navigation`**, calculée côté serveur par `NavigationService` (`app/services/navigation_service.ts`) depuis le **type** de l'organisation courante (`buyer` / `supplier` / `both`) et le **rôle** de l'utilisateur dedans. Ce n'est jamais une autorisation : chaque route re-vérifie ses droits.
  - visiteur : Catalogue (`products.index`), Fournisseurs (`suppliers.index`) ;
  - connecté : Tableau de bord (`dashboard.show`) + les deux précédents ;
  - `buyer` / `both` : Mes demandes de devis (`rfqs.index`) ;
  - `supplier` / `both` : Mes produits, Demandes reçues, Profil fournisseur ;
  - rôle `owner` / `admin` : Membres, Paramètres ;
  - administrateur plateforme (`platform_role = admin`) : Administration (`admin.dashboard`), avec ou sans organisation. Le lien vit dans le menu (donc aussi dans le panneau mobile) et non plus à part dans le header.
- `OrganizationSummaryType` expose maintenant **`organizationType`**.
- Front : `inertia/components/app_nav.vue` (horizontal ou vertical, état actif via `isActivePath`, `shared/helpers/navigation.ts`), `inertia/components/user_menu.vue` (initiales → « Mon compte », déconnexion) et panneau burger sur mobile dans `layouts/default.vue`.
- i18n : clés `common.nav.*` dans les 9 langues.

## Tableau de bord

- Route **`GET /:locale/dashboard`** (`dashboard.show`), groupe `onboarded`.
- **Redirection post-connexion** (mot de passe et passkey) et fin d'onboarding vers `dashboard.show` (au lieu de `home`).
- `DashboardService` + types `shared/types/dashboard.ts` :
  - acheteur (`buyer` / `both`) : nombre de demandes par statut (`draft`, `published`, `closed`) et cinq dernières réponses fournisseurs (`rfq_suppliers.status = responded`) ;
  - fournisseur (`supplier` / `both`) : demandes reçues non lues (statut `sent`), produits actifs, complétude du profil (bio, périmètre et délai de livraison, quantité minimale, délai de réponse, certifications).
- Page `dashboard/show` ; composants `components/dashboard/{buyer,supplier}_summary.vue` et générique `components/base/base_stat.vue`. Textes dans `resources/lang/*/dashboard.json`.

## Accueil

- L'accueil n'était déjà plus le template AdonisJS (aucune clé `home.cards.*` ni lien vers la doc Adonis).
- Nouvelle section `marketing/discover_section.vue` sous le hero : barre de recherche vers `products.index?search=`, CTA « Je suis acheteur » / « Je suis fournisseur » vers l'inscription, catégories mises en avant (`ProductCatalogueService#featuredCategories`, six au plus, uniquement celles qui ont un produit actif, liées à `products.index?categoryId=`). Clés `landing.discover.*`.
- Le bouton « Ouvrir l'app » du header marketing pointe vers `dashboard.show`.

## Tests

- Vitest : `tests/inertia/app_nav.spec.ts`, `tests/inertia/discover_section.spec.ts`.
- Japa : `tests/unit/navigation.spec.ts`, `tests/functional/{dashboard,navigation}.spec.ts`, complément dans `marketing.spec.ts` ; `onboarding.spec.ts` attend désormais `/fr/dashboard`.
