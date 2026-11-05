# Suivi de l'IA et des traductions automatiques (administration)

> Date : 2026-11-05

Issue #177 : l'équipe admin mesure ce que coûte la traduction automatique Mistral, voit la couverture par langue, relance un rattrapage sans ligne de commande et relit les traductions générées.

## Journal des appels (`ai_calls`)

- Migration `1794000000006_create_ai_calls_table` : service, modèle, entité et identifiant (sans clé étrangère : le journal survit aux suppressions), langue source, langues cibles, tokens d'entrée et de sortie, durée, statut (`success`, `truncated`, `failed`), erreur (500 caractères au plus), date. Index sur `created_at` et `(status, created_at)`.
- `TranslationService` journalise **chaque appel au fournisseur** via `AiCallService` : succès, réponse tronquée (le lot est ensuite scindé, chaque moitié est un nouvel appel) et échec. Un appel évité par l'idempotence (`translation_key`) n'écrit rien. `AiCallService.record()` ne lève jamais : perdre une ligne de journal ne fait ni échouer ni rejouer une traduction.
- **Rétention de 90 jours** : `PurgeAiCallsJob` (planifié chaque nuit, `start/scheduler.ts`) supprime les appels plus anciens (`AiCallService#purge`).
- `TranslationProvider.translate()` reçoit un paramètre optionnel `usage` que `MistralTranslationProvider` remplit depuis la réponse de l'API (aussi sur une réponse rejetée : l'appel est facturé). Les traducteurs de test qui l'ignorent restent valides.
- `ENTITY_TRANSLATION_TABLES` (`shared/types/ai.ts`) remplace le registre privé du service : tables, clés étrangères, table parente et champs traduits par type d'entité.

## Écrans et routes (droit `ai.manage`, admin seul)

Nouveau droit `ai.manage`, porté par le seul rôle `admin` (403 pour les autres rôles plateforme, onglet masqué).

- `GET /:locale/admin/ai` (`admin.ai.index`, `AiController`) : appels, échecs, réponses tronquées et tokens sur 30 jours, **coût estimé**, couverture de traduction par langue, volume quotidien (jours en UTC ; la colonne « Échecs » ne compte que les appels `failed`, comme le compteur) et dix derniers échecs.
- `POST /:locale/admin/ai/backfill` (`admin.ai.backfill`) : rattrapage des traductions manquantes, tous types ou un seul. Traité **par la queue** (`TranslationBackfillJob`, qui appelle `TranslationBackfillService` comme `node ace translation:backfill`) : la requête rend la main aussitôt. Refusé si `AI_TRANSLATION_ENABLED` est faux, ou si un rattrapage a été demandé depuis moins de 10 minutes (verrou consultatif PostgreSQL : deux clics simultanés n'en lancent qu'un). Audit `ai.backfill_requested`. Idempotent : ce qui est déjà traduit à jour ne rappelle pas l'IA, une traduction manuelle n'est jamais écrasée.
- `GET /:locale/admin/ai/translations` (`admin.ai.translations`) : traductions hors langue source, 25 par page, avec le texte source en repère. Filtres : type de contenu (produit par défaut), langue, origine (`auto` par défaut, `manual`), texte traduit (jokers `%` et `_` cherchés tels quels).
- `PATCH /:locale/admin/ai/translations/:entity/:id/:translationLocale` (`admin.ai.translations.correct`) : corrige ou **valide telle quelle** une traduction. Elle passe en `is_auto = false` : l'IA ne l'écrase plus. Le nom (ou libellé) ne peut pas être vidé ; la description peut l'être. La langue source (saisie du fournisseur) n'est pas modifiable ici. Un produit corrigé est réindexé (`ProductChanged`). Audit `translation.corrected` (avant/après, 500 caractères au plus par valeur).

## Coût estimé

Aucun tarif par défaut : les prix changent et un coût inventé induirait en erreur. Renseigner `AI_PRICE_INPUT_PER_MILLION`, `AI_PRICE_OUTPUT_PER_MILLION` et, si besoin, `AI_PRICE_CURRENCY` (`EUR` par défaut). Sans tarif, l'écran affiche les tokens et invite à le configurer.

## Couverture

Pour chaque langue : nombre d'entités avec une traduction (générée par l'IA / saisie ou relue) sur le total (produits actifs + catégories, attributs, valeurs d'attribut, certifications, techniques de marquage). La langue source de chaque entité compte comme saisie. Les traductions de produits inactifs sont écartées comme leurs produits. Le total n'applique pas les règles de visibilité du rattrapage (organisation archivée, produit rejeté) : la couverture d'un catalogue partiellement masqué est légèrement sous-estimée.

## Hors périmètre

Bascule du drapeau `AI_TRANSLATION_ENABLED` depuis l'interface (variable d'environnement), historique de coût par modèle, journalisation de la recherche par image (`vision`, autre service).

## Tests

- Vitest : `tests/inertia/admin_ai.spec.ts` (tableau de bord, rattrapage, relecture) ; `tests/unit/platform_permissions.spec.ts`.
- Japa : `tests/functional/admin_ai.spec.ts` (journal, droits, agrégats, coût, rattrapage et délai, relecture, correction, refus), non exécutable en local sans pgvector ≥ 0.7 : à vérifier en CI.
