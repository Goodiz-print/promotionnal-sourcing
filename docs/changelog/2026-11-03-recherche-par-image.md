# Recherche par image

> Date : 2026-11-03

Un acheteur connecté peut envoyer la photo d'un objet (vu en salon, chez un concurrent…) pour retrouver des produits proches du catalogue.

## Fonctionnement

1. Un bouton « Rechercher par image » apparaît sous le champ de recherche du catalogue (`/:locale/products`) pour les utilisateurs connectés, si la fonction est active.
2. La photo part en `POST /:locale/products/image-search` (route `products.image_search`, multipart, champ `image`, `jpg`/`jpeg`/`png`/`webp`, 5 Mo, e-mail vérifié, pas d'organisation requise).
3. `ImageSearchService` normalise l'image (rotation EXIF, 1024 px max, JPEG, métadonnées retirées ; un contenu illisible est refusé) puis `ImageDescriptionProvider` (implémentation `MistralImageDescriptionProvider`, modèle vision Pixtral) la décrit en 3 à 8 mots-clés dans la langue de l'acheteur.
4. Redirection vers `products.index?search=<mots-clés>&imageSearch=1` : la recherche hybride Meilisearch existante fait le reste (ADR 0002), sans réindexation. Un bandeau rappelle que le terme vient de la photo ; le terme reste modifiable dans le champ de recherche.

L'image n'est **jamais stockée** (ni Cellar, ni `storage_objects`) ni journalisée.

## Configuration

- `AI_VISION_ENABLED` (défaut `false`), `MISTRAL_VISION_MODEL` (défaut `pixtral-12b-latest`), `MISTRAL_API_KEY` requise. Bloc `vision` de `config/ai.ts`.
- Sans fonction active ou sans clé, le bouton est masqué (prop `imageSearchEnabled`) et la route répond par un message d'erreur.
- Limite de débit `imageSearchThrottle` : 20 envois par heure et par compte (`start/limiter.ts`).

## Journal des recherches (#171)

Une recherche issue d'une photo est enregistrée avec la source `catalogue_image` (le terme généré va dans `query`, jamais l'image). Pas de migration : la colonne `source` est une chaîne libre.

## Erreurs

`ImageSearchDisabledError`, `InvalidImageError`, `ImageDescriptionFailedError` (`app/exceptions/image_search_errors.ts`) : message flash puis retour à la page (clés `products.imageSearch.*`, 9 langues).

## Tests

`tests/functional/image_search.spec.ts`, `tests/unit/mistral_image_description_provider.spec.ts`, `tests/inertia/image_search_button.spec.ts` ; faux modèle dans `tests/utils/fake_image_description_provider.ts`.
