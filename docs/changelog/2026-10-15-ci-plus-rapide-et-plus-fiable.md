# CI plus rapide et plus fiable (phase 1)

> Date : 2026-10-15

- **Annulation des runs obsolètes** : `concurrency` par ref — un nouveau push sur
  une PR annule le run en cours (jamais sur `main`). `permissions: contents: read`.
- **`timeout-minutes` sur chaque job** (10 à 15 min) : un test qui ne rend pas la
  main (`forceExit: false`) ne bloque plus un runner pendant 6 h.
- **Typecheck en CI** : `pnpm typecheck` (tsc + vue-tsc) tourne désormais après
  `pnpm run build` dans le job `build`, qui génère les `#generated/*` requis.
- **Correctif CI — `jsonschema` vs Node ≥ 24.21** : `@adonisjs/ace` valide les
  commandes de l'app (`commands/*`) avec `jsonschema@1.5.0`, qui résout les
  `$ref` via `new URL(…, 'thismessage::/')` — base invalide pour le parseur d'URL
  de Node 24.21 (`TypeError: Invalid URL`). Toute commande ace applicative
  (`embeddings:backfill`) et donc le premier `truncate()` des tests plantaient
  dès que le runner passait de Node 24.19 à 24.21 (`main` aurait été rouge
  aussi). Patch pnpm minimal (`patches/jsonschema@1.5.0.patch`, base
  `thismessage:/`) ; à retirer quand `jsonschema` publie un correctif.
- **Setup factorisé** : action composite `.github/actions/setup` (pnpm, Node,
  `pnpm install --frozen-lockfile`) utilisée par les 4 jobs ; variables d'env de
  test déclarées une seule fois au niveau du workflow.
