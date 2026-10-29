# Comptes de démo fournisseur et agence

> Date : 2026-10-29

`DevUserSeeder` crée deux comptes de démo (mot de passe `password`, email vérifié) et ne sème plus `malolebrin@gmail.com` :

- **Fournisseur** : `fournisseur@promotionnal-sourcing.test`, `owner` de l'organisation `eurogoods-org` (fiche catalogue `eurogoods` et ses produits).
- **Agence** (acheteur qui cherche des produits) : `agence@promotionnal-sourcing.test`, `owner` de l'organisation acheteuse `promotionnal-sourcing`, avec un profil d'agence (objets de communication, 2-10 personnes, 100-500 k€ d'achats).

Création idempotente (`updateOrCreate`). Constantes `DEV_SUPPLIER_EMAIL` et `DEV_AGENCY_EMAIL` exportées ; `DEV_USER_EMAIL` supprimée. Le helper de tests `seededDevUser(slug)` retrouve désormais le `owner` de l'organisation semée au lieu d'un email fixe.
