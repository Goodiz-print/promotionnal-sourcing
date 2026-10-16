# Traduction automatique par lot à la sauvegarde (#75)

Date : 2026-10-16

- **Déclenchement** : sauvegarde d'un produit **publié** (`isActive`) ou d'une catégorie. Un job de queue (`TranslateEntityJob`) traduit le contenu vers les 31 autres langues de `TRANSLATION_LOCALES` (liste figée de #75 : 24 UE, 8 hors UE, sans ru ni be).
- **Un seul appel Mistral par entité** : toutes les langues à traduire partent dans la même requête, la réponse est un objet `{ locale: { champ: texte } }`. La réponse est rejetée si une langue ou un champ manque.
- **Champs** : `name` et `description` pour un produit, `name` pour une catégorie.
- **Idempotence** : une clé par langue (source, cible, texte source, modèle, version du prompt). Une langue à jour n'entre pas dans l'appel.
- **Traduction manuelle protégée** : une ligne sans `translation_key` (saisie par le fournisseur) n'est jamais écrasée.
- **Pas de relecture humaine** : la traduction machine est publiée telle quelle.
- **Non traité ici** : traduction des attributs et valeurs d'attributs, colonne `source_locale`, backfill des produits existants, et mesure de coût sur 1 000 produits (voir #75).
- Configuration : le job ne fait rien tant que `AI_TRANSLATION_ENABLED` est faux.
