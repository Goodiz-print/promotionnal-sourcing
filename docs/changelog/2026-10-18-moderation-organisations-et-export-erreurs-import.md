# Modération des organisations et export des erreurs d'import

Date : 2026-10-18

- **Organisation rejetée** : ses produits et sa fiche fournisseur disparaissent du catalogue public et de l'annuaire.
- **Export CSV des erreurs d'import** (`ImportJobService.errorsToCsv`) : `ligne;colonne;message;valeur_recue`, valeurs neutralisées contre l'injection de formules. Téléchargement HTTP à venir avec l'écran d'import.
- **Erreurs de ligne enrichies** : colonne et valeur reçue, optionnelles.
- **Helper SQL partagé** `latestDecisionIsRejectedSql` (`shared/helpers/moderation.ts`).
- **Tests** : 6 fonctionnels (modération catalogue) et 4 unitaires (CSV).
