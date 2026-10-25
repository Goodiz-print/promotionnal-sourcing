# Vectorisation des produits activée dès que le provider est configuré

> Date : 2026-10-25

La recherche sémantique (et l'embedder `userProvided` de Meilisearch, #112) a besoin de vecteurs : la vectorisation n'est plus désactivée par défaut.

- **Activation** : `AI_EMBEDDINGS_ENABLED` est désormais facultative. Active dès que le provider est configuré (`MISTRAL_API_KEY`, ou `AI_API_KEY` / `AI_BASE_URL` pour `openai-compatible`) ; coupée sans identifiants (dev local, CI), et en `NODE_ENV=test` sauf demande explicite. `=false` la coupe même avec une clé ; `=true` sans identifiants échoue au démarrage.
- **`node ace embeddings:backfill`** : parcours par lots de 200 (la mémoire ne grossit plus avec le catalogue), `--all` pour repasser tous les produits après un changement de modèle (idempotent : seules les clés changées rappellent l'API), et chaque vecteur écrit déclenche la synchronisation de l'index Meilisearch. Code de sortie 1 si la vectorisation est coupée.
- **Procédure d'activation en production** : `docs/catalogue.md` (« Activer la vectorisation »).
- **Attention** : une clé Mistral déjà présente dans l'environnement active désormais la vectorisation sans autre réglage, donc des appels facturés à chaque création ou mise à jour de produit (idempotents : un texte inchangé ne rappelle pas l'API).
