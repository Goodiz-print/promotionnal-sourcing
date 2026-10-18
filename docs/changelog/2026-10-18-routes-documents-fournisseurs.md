# Routes et validation des documents fournisseurs (#60)

Date : 2026-10-18

- **Routes** :
  - `POST /fr/supplier/profile/documents` : ajout d'un document d'organisation (`kind` : `catalogue`, `certificate`, `other` ; `file` : PDF).
  - `DELETE /fr/supplier/profile/documents/:id` : retrait, avec 404 pour un document d'une autre organisation.
  - `POST /fr/supplier/products/:id/documents` : ajout d'une fiche technique.
  - `DELETE /fr/supplier/products/:id/documents/:documentId` : retrait.
- **Droits** : `canManageSupplierProfile` pour le profil, `canManageProducts` pour les produits.
- **Validation** : PDF de 20 Mo maximum (extension et en-tête `%PDF-`). Un fichier qui n'est pas un PDF est refusé.
- **Réponses** : redirection Inertia avec message de confirmation (`documents.uploaded`, `documents.deleted`, traduit dans les 9 langues).
- **Tests** : 5 fonctionnels de routes (ajout, refus d'un non-PDF, 404 cross-organisation, refus d'un simple membre, cycle fiche technique).
- **Non couvert** : interfaces (profil, annuaire public, formulaire produit).
