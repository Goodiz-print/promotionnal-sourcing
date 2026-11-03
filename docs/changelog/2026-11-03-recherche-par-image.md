# Recherche par image

> Date : 2026-11-03

Un acheteur connecté peut envoyer la photo d'un objet (vu en salon, chez un concurrent…) pour retrouver des produits proches du catalogue.

## Fonctionnement

1. Un bouton « Rechercher par image » apparaît sous le champ de recherche du catalogue (`/:locale/products`) pour les utilisateurs connectés, si la fonction est active.
2. La photo part en `POST /:locale/products/image-search` (route `products.image_search`, multipart, champ `image`, `jpg`/`jpeg`/`png`/`webp`, 5 Mo, e-mail vérifié, pas d'organisation requise).
3. `ImageSearchService` normalise l'image (rotation EXIF, 1024 px max, JPEG, métadonnées retirées ; un contenu illisible est refusé) puis `ImageDescriptionProvider` (implémentation `MistralImageDescriptionProvider`, modèle vision Pixtral) la décrit en 3 à 8 mots-clés dans la langue de l'acheteur.
4. Redirection vers `products.index?search=<mots-clés>` : la recherche hybride Meilisearch existante fait le reste (ADR 0002), sans réindexation. Le terme voyage aussi en **flash** de session (`imageSearchQuery`) : la page sait ainsi qu'il vient d'une photo et affiche un bandeau, sans paramètre d'URL falsifiable ni partageable. Le terme reste modifiable dans le champ de recherche ; le bouton force `preserveState: false` pour que la barre de filtres reparte du terme généré.

L'image n'est **jamais stockée** (ni Cellar, ni `storage_objects`) ni journalisée. Elle est décodée avec une limite de 40 Mpx (`IMAGE_SEARCH_MAX_INPUT_PIXELS`) contre les images « bombes » ; seul un échec de décodage est présenté comme « image invalide », une erreur de lecture du fichier temporaire remonte en erreur serveur. Elle est envoyée à Mistral AI : la politique de confidentialité (9 langues) l'indique (données collectées et destinataires) ainsi que l'aide sous le bouton (`products.imageSearch.privacy`).

## Configuration

- `AI_VISION_ENABLED` (défaut `false`), `MISTRAL_VISION_MODEL` (défaut `pixtral-12b-latest`), `MISTRAL_API_KEY` requise. Bloc `vision` de `config/ai.ts`.
- Sans fonction active, sans clé, hors connexion ou tant que l'e-mail n'est pas vérifié, le bouton est masqué (prop `imageSearchEnabled`) et la route répond par un message d'erreur. La disponibilité est calculée par `isImageSearchAvailable()` (`app/services/vision/image_search_availability.ts`) : le catalogue public ne dépend pas du service ni du client Mistral.
- Règles d'envoi d'image partagées avec la galerie produit : `shared/types/image_upload.ts`.
- Limite de débit `imageSearchThrottle` : 20 envois par heure et par compte (`start/limiter.ts`).

## Journal des recherches (#171)

Une recherche issue d'une photo est enregistrée avec la source `catalogue_image` (le terme généré va dans `query`, jamais l'image), uniquement quand le flash posé par la route d'envoi correspond au terme de la page. Pas de migration : la colonne `source` est une chaîne libre. Le libellé « Catalogue (recherche par image) » est ajouté dans `admin.json` (9 langues) pour l'écran « Ce que cherchent les clients ».

## Erreurs

`ImageSearchDisabledError`, `InvalidImageError`, `ImageDescriptionFailedError` (`app/exceptions/image_search_errors.ts`) : message flash puis retour à la page (clés `products.imageSearch.*`, 9 langues).

## Tests

`tests/functional/image_search.spec.ts`, `tests/unit/mistral_image_description_provider.spec.ts`, `tests/inertia/image_search_button.spec.ts` ; faux modèle dans `tests/utils/fake_image_description_provider.ts`.
