# Activation des 32 langues de contenu

> Date : 2026-10-30

Solde de #97 : le contenu du catalogue (produits, catégories, attributs, valeurs) passe de
`fr`/`en` aux 32 langues de la traduction automatique (#75).

- **Langues** : `CONTENT_LOCALES` reprend `TRANSLATION_LOCALES` (24 langues de l'UE et 8 hors UE,
  `fr` et `en` en tête). `CONTENT_LOCALE_LABELS` donne le nom de chaque langue dans sa propre langue.
  `contentLocaleFor` est supprimée : toute langue de contenu est servie telle quelle.
- **Saisie** : les validateurs produit et catégorie acceptent les 32 langues pour `sourceLocale` et
  `translations` (`perContentLocale`, `app/validators/localized_content.ts`). Les formulaires affichent la
  langue source et une autre langue au choix (`useVisibleContentLocales`) ; clé `otherLocale` ajoutée
  aux 9 langues d'interface (produits, catégories). `FlagIcon` affiche une pastille neutre quand la
  langue n'a pas de drapeau dédié.
- **Repli d'affichage** : `resolveTranslation(translations, locale, sourceLocale?)` retombe sur la
  langue source de l'entité, puis `en`, puis `fr`, puis la première locale par ordre alphabétique
  (déterministe). Les transformers produit, catégorie et demande de devis passent la langue source.
- **Rattrapage** : commande `node ace translation:backfill [--limit=N] [--entity=product,category]`
  (`TranslationBackfillService`). Elle met en file les produits actifs, catégories, attributs et valeurs
  d'attributs ; idempotente (clés de `TranslationService`), refusée si `AI_TRANSLATION_ENABLED` est faux.
  `--limit` permet de mesurer le coût réel sur un échantillon.
- **Traduction** : un seul appel Mistral par entité couvre les 31 langues cibles (déjà le cas) ; le
  plafond de sortie `aiConfig.translation.maxTokens` est désormais transmis et une réponse tronquée
  (`finish_reason = length`) est rejetée, donc rejouée par le job.
- **Comptes fournisseurs** : à la création d'un fournisseur, seules les traductions `fr` et `en` du nom
  de l'organisation sont écrites (les autres langues retombent sur l'anglais).
- **Recherche** : inchangée (ADR 0002), toujours multilingue sur toutes les sous-clés ; la locale de
  l'utilisateur n'entre pas dans la requête Meilisearch.
- **Nettoyage** : le log et le commentaire de `ProductSearchService` ne parlent plus d'un repli PostgreSQL
  disparu. Les points `\dFd` / `\dF` et le test de repli sur `simple` de #97 n'ont plus d'objet
  (`LOCALE_TSCONFIG` a été supprimé avec la recherche PostgreSQL).
