# Idempotence des appels IA (Mistral)

> Date : 2026-10-16

Relancer un job (retry, crash, redéploiement) ne refacture plus un appel IA déjà
fait (#88). Chaque résultat est protégé par une **clé d'idempotence** (sha256 d'une
sérialisation JSON stable) stockée sur la ligne qu'elle protège.

- **Embeddings** — `products.embedding_key` = hash de (texte source, provider,
  modèle, dimension). `EmbeddingService.embedAndStore` saute l'appel si la clé est
  inchangée et qu'un vecteur existe ; vecteur et clé sont écrits dans un seul
  `UPDATE`. `EmbeddingProvider` expose désormais `model`.
- **Traductions** — `translation_key` sur `product_`, `category_`, `attribute_` et
  `attribute_value_translations`. `TranslationService.translate` : clé = hash de
  (type d'entité, id, champs, locale source, locale cible, hash du texte source,
  modèle, `ai.translation.promptVersion`) ; clé inchangée → Mistral n'est pas appelé ;
  sinon appel puis upsert sur `(entité, locale)` en une requête.
- **Traducteur** — `TranslationProvider` (classe abstraite) lié à
  `MistralTranslationProvider` dans `providers/ai_provider.ts` ; `TranslateEntityJob`
  (no-op tant que `AI_TRANSLATION_ENABLED` est faux ; `MISTRAL_TRANSLATION_MODEL`,
  défaut `mistral-small-latest`).
- **Journalisation** — chaque appel est loggé avec `idempotencyKey` et
  `outcome` (`called` | `skipped`).
- **Migration** `…969` (avec `down()`).
- **Non couvert** — aucune sauvegarde ne dispatche encore `TranslateEntityJob` et les
  traductions ne sont pas marquées « auto » : le job écraserait une correction
  manuelle. Le déclenchement (`sourceLocale`, marquage « auto ») relève de #75.
=======
