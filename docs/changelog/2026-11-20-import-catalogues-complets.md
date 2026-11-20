# Import des catalogues fournisseurs complets, connecteurs Inspirion et Makito

> Date : 2026-11-20

`pnpm db:populate` (= `node ace supplier:import all --full`) peuple une base de dev / staging avec les catalogues **complets** de tous les fournisseurs configurés. Documentation : [`docs/supplier-feeds.md`](../supplier-feeds.md).

## Commande `supplier:import`

- `--full` : catalogue entier, sans limite (`--limit` reste à 200 par défaut sinon). Un import intégral est un flux complet : les fiches du fournisseur absentes du flux sont désactivées.
- `--refresh` : retélécharge les flux au lieu de réutiliser le cache disque.
- Nouveau connecteur accepté : `makito`.
- Un point d'avancement est journalisé toutes les 500 fiches.

## Cache disque des flux

- `SupplierHttpClient.getJson(url, headers, cache)` écrit la réponse en flux dans `tmp/supplier_feeds/` (ignoré par git, contient des prix nets) et la réutilise pendant 12 h. Enchaîner `--dry-run` puis l'import réel ne retélécharge rien.
- `SupplierHttpClient.postJson` (login par identifiants), jamais mis en cache, corps jamais journalisé.
- Timeout HTTP par défaut porté de 120 s à 300 s (`SUPPLIER_FEED_TIMEOUT_MS`).

## Connecteur Makito (nouveau fournisseur)

- Variables `MAKITO_EMAIL` et `MAKITO_PASSWORD` (optionnelles, secret). `POST /api/login` renvoie le jeton (lu dans `token` ou, comme le fait l'API réelle, dans `msg`), puis `Authorization: Bearer`.
- Fiche = `ref`, déclinaisons = `matnr` (couleur × taille), stock immédiat, paliers de prix, images par rôle, zones et techniques de marquage avec frais de cliché et paliers, délai de marquage export, carton maître, code douane, pays d'origine.
- Le nom de modèle (« Betty ») est préfixé du type d'article (« Foulard ») pour être lisible et classable.
- Validé sur le catalogue réel : 4 519 fiches, 16 939 déclinaisons ; fiches sans catégorie reconnue ramenées de 534 à 381 (8 %) par l'enrichissement des synonymes. Second import : 0 création.

## Connecteur Inspirion (LEO API)

- Remplace le squelette : en-tête `X-Gateway-API-Key`, routes `v2/products`, `v2/pricelist`, `v1/stock`, `v1/products/categories`, `v1/printdata`, `v2/print-prices`, `v2/delivery-time`.
- Fiche = `sku`, déclinaisons = `article_id` ; prix du compte par déclinaison, stock France, positions et méthodes d'impression avec le prix du code par défaut.
- Écrit d'après la documentation : la clé fournie est refusée par l'API (`401 Invalid API key`), le mapping reste à valider sur le flux réel.

## Divers

- Connecteur Axpol retiré : squelette `axpol_connector.ts`, clé `axpol` de la commande, variable `AXPOL_API_KEY` et exception `SupplierConnectorNotImplementedException` (plus aucun connecteur en attente).
- Synonymes enrichis d'après le bilan du catalogue Makito (`database/data/catalogue/`) : catégories (gamelle, glacière, banane, canif, bidon, foulard…), techniques (libellés espagnols, « DTF1 », « DIGITAL W1 », quadrichromie) et couleur « fucsia ». Rejouer `category_seeder`, `marking_technique_seeder` et `attribute_seeder` pour les appliquer à une base existante.
- `normalizeCountry` reconnaît les noms de pays espagnols et anglais courants (« España », « Bangladesh », « Polonia »…).
- Helpers `sectionPriceTiers` (colonnes `section_n` / `price_n`) et `parseGroupedInt` (`"24.000"` = 24 000).
