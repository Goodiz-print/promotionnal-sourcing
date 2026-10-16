# Codegen AdonisJS partiellement sorti du versionnement

> Date : 2026-08-20

`.adonisjs/` contient **deux** familles de fichiers générés, qui n'ont pas le
même cycle de vie — seuls les premiers sont désormais ignorés par git (ils
l'étaient déjà par `.prettierignore`) :

- **Régénérés par `ace build` / `serve` / `test`** → ignorés :
  `client/data.d.ts`, `client/manifest.d.ts`, `server/{controllers,events,listeners,pages.d,policies}.ts`.
- **Produits par le seul `ace serve`** (tuyau, qui a besoin du routeur booté) →
  **restent versionnés** : `client/registry/{index.ts,schema.d.ts,tree.d.ts}` et
  `server/routes.d.ts`. La CI ne lance jamais le serveur : sans eux, `pnpm build`
  échoue (`inertia/client.ts` importe `@generated/registry`) et les pages SSR
  répondent 500 en test.

`database/schema.ts` reste lui aussi versionné bien que généré : sa regénération
(`node ace schema:generate`) exige une base de données, indisponible dans les
jobs CI `lint` et `build`, alors que tous les modèles l'importent.
