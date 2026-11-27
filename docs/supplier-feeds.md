# Connecteurs de flux fournisseurs

Import des **catalogues réels** des fournisseurs (produits, déclinaisons, prix nets, stock, marquage, images) pour peupler les bases de **dev / staging** avec des données réalistes : `node ace supplier:import`.

> Les identifiants sont des **accès réels** et les prix importés sont les **prix nets confidentiels du compte**. Ils ne vont que dans `.env` et dans une base de dev/staging, jamais dans le code, les fixtures, la doc ni un commit.

## Usage

```sh
node ace supplier:import pfconcept --limit=20 --dry-run   # récupère et normalise, n'écrit rien
node ace supplier:import pfconcept --limit=200            # import (200 produits par défaut)
node ace supplier:import passot --locale=en
node ace supplier:import all                              # les connecteurs configurés, les autres sont ignorés
node ace supplier:import makito --full --dry-run          # catalogue entier, sans écriture
pnpm db:populate                                          # = supplier:import all --full
```

`pnpm db:populate` peuple une base de dev / staging avec **tous les catalogues complets** des connecteurs configurés (lancer `node ace migration:run` avant). Un fournisseur en échec n'arrête pas les suivants ; la commande sort en code 1 s'il y a eu un échec. L'indexation Meilisearch suit par la queue (`ProductChanged`) ; si le worker ne tourne pas, rattraper avec `node ace search:reindex`.

| Option                      | Effet                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `--limit`                   | Nombre maximal de produits (modèles) par fournisseur, 200 par défaut                         |
| `--full`                    | Catalogue entier (ignore `--limit`) ; les fiches absentes du flux sont désactivées           |
| `--allow-mass-deactivation` | Désactive les fiches absentes du flux même au-delà du garde-fou (voir « Activation »)        |
| `--refresh`                 | Retélécharge les flux au lieu de réutiliser le cache disque (voir « Cache des flux »)        |
| `--locale`                  | Langue du flux : `fr` (défaut), `en`, `de`, `es`                                             |
| `--dry-run`                 | Bilan (produits, catégories et techniques non reconnues) sans aucune écriture en base        |
| `--store-images`            | Copie les images dans Cellar (clé sha256, dédoublonnage) au lieu de garder l'URL fournisseur |
| `--skip-images`             | Ne touche pas à la galerie                                                                   |
| `--force`                   | Autorise l'exécution avec `NODE_ENV=production` (refusée sinon)                              |

Relançable sans risque : un second import met les fiches à jour, sans doublon.

## Configuration (`.env`)

| Variable                   | Fournisseur | Rôle                                                                                                                        |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PFCONCEPT_FEED_CODE`      | PF Concept  | Code distributeur dans les URLs des flux prix / stock / prix de marquage (`pricefeed_<code>_v3.json`)                       |
| `PASSOT_API_KEY`           | Passot      | En-tête `PI-API-KEY` de l'API PiDesign                                                                                      |
| `INSPIRION_API_KEY`        | Inspirion   | En-tête `X-Gateway-API-Key` de la LEO API (clé **client**)                                                                  |
| `MAKITO_EMAIL`             | Makito      | Identifiant du compte client (`POST /api/login`)                                                                            |
| `MAKITO_PASSWORD`          | Makito      | Mot de passe du compte client ; le jeton renvoyé par le login n'est jamais stocké                                           |
| `SUPPLIER_FEED_TIMEOUT_MS` | tous        | Timeout HTTP des flux (images : 30 s fixes), 300 s par défaut (flux PF Concept ~200 Mo, API Makito jusqu'à 2 min par appel) |
| `SUPPLIER_FEED_USER_AGENT` | tous        | User-Agent annoncé, `GoodizprintSourcing/1.0` par défaut                                                                    |

Les URLs journalisées passent par `redactUrl` : tout segment `feed_<…>_v3` hors code langue est masqué, quel que soit le format du code, ainsi que les valeurs exactes des secrets configurés et la query string.

### Flux annexes indisponibles

Chaque connecteur lit d'abord le flux produits (obligatoire), puis des flux annexes : prix, stock, marquage, catégories… Un flux annexe en échec (pas encore activé côté fournisseur, timeout) est journalisé et listé au bilan (`missingFeeds`), et le catalogue est normalisé sans ces données.

- **Import intégral (`--full`)** : l'import est **annulé avant toute écriture** (`SupplierFeedIncompleteException`, code de sortie 1). Variantes, paliers et marquages sont écrits en « remplace l'ensemble » : écrire un catalogue sans son flux prix effacerait tous les prix existants du fournisseur.
- **Import limité (`--limit`)** et `--dry-run` : l'import continue, le bilan avertit des flux manquants. Les fiches réimportées perdent alors les données du flux manquant jusqu'au prochain import réussi.

### Cache des flux

Les connecteurs lisent leurs flux par `SupplierHttpClient.getJson(url, headers, cache)` : la réponse est écrite en flux dans `tmp/supplier_feeds/<sha256>.json` (dossier ignoré par git) puis relue. Une copie de moins de 12 h (`http.cacheTtlMs`) est réutilisée : enchaîner `--dry-run` puis l'import réel ne retélécharge rien. `--refresh` force le téléchargement. Le nom de fichier est une empreinte de l'URL et du compte, sans secret en clair, mais **le contenu porte les prix nets** : ne pas partager ce dossier. Stock et prix peuvent donc dater de 12 h au plus sans `--refresh`. Le login Makito (`postJson`) et les images ne passent jamais par le cache. Une coupure pendant le téléchargement est retentée (2 nouveaux essais) et ne laisse jamais de copie tronquée.

Toutes sont optionnelles (`Env.schema.secret.optional()`) : sans elles l'application démarre, et le connecteur concerné lève `SupplierConnectorNotConfiguredException` à l'usage.

## Architecture

```
commands/supplier_import.ts             commande ace (DI sur run())
app/services/supplier_feed/
  supplier_connector.ts                 classe abstraite : key, identity, isConfigured(), fetchCatalogue()
  pfconcept_connector.ts                PF Concept (flux JSON v3)
  passot_connector.ts                   Passot / PiDesign (API REST Magento)
  inspirion_connector.ts                Inspirion (LEO API) : lecture des flux seulement
  inspirion_feed_index.ts               … index des flux annexes (fonctions pures, une par flux)
  inspirion_feed_mapper.ts              … fiche → NormalizedProduct (fonctions pures)
  makito_connector.ts                   Makito (Products API, login par identifiants) : lecture des flux seulement
  makito_feed_index.ts                  … index des flux annexes (fonctions pures, une par flux)
  makito_feed_mapper.ts                 … fiche → NormalizedProduct (fonctions pures)
  supplier_connector_registry.ts        résolution par clé
  supplier_http_client.ts               GET / POST JSON, cache disque, timeout, nouvel essai sur 5xx ; URLs masquées dans les logs
  feed_tree.ts                          parcours tolérant des JSON (nœuds trouvés par leurs clés)
  supplier_reference_service.ts         référentiels (catégories, couleurs, matières, techniques) + fiche fournisseur
  supplier_catalogue_importer.ts        persistance
shared/types/supplier_feed.ts           NormalizedProduct & co
shared/helpers/supplier_feed.ts         parsing (« 17,5 », pays, cm→mm, redactUrl…)
shared/helpers/reference_matcher.ts     rapprochement libellé brut → référentiel
```

Un connecteur **ne fait que lire** : il traduit le flux en `NormalizedProduct[]`. Tout l'écrit en base passe par `SupplierCatalogueImporter`, commun à tous les fournisseurs.

### Persistance

- **Fournisseur** créé / mis à jour par slug (`pf-concept`, `passot-innovation`, `inspirion`, `makito`), sans organisation rattachée.
- **Produit** rapproché par `(supplier_id, external_id)` : la colonne `products.external_id` (code modèle PF Concept, SKU parent Passot, `sku` Inspirion, `ref` Makito) porte un index unique. Slug `<fournisseur>-<external_id>`, suffixé `-2`, `-3`… si deux codes donnent le même slug (`AB 12` / `AB-12`) : le premier suffixe libre est calculé en mémoire après **une seule** lecture (`slug = base OR (slug LIKE 'base-%' AND slug ~ '^base-[0-9]+$')`, helper `firstFreeSlug`) : le `LIKE` est servi par l'index `products_slug_pattern_index` (`varchar_pattern_ops`), la regex écarte les codes voisins (`…-ab-12-extra`). La base est tronquée à 247 caractères pour que le suffixe tienne dans la colonne (`truncateSlugBase`) ; un code sans caractère sluggable garde la base `<fournisseur>-`. Une violation d'unicité sur le slug ou sur `(supplier_id, external_id)`, due à un import concurrent, est journalisée (`warn`) et relance une fois la transaction de la fiche ; toute autre violation (SKU en double…) est comptée en échec sans nouvel essai.
- **Activation** : une fiche est active à sa création ; un import ne touche plus jamais `is_active` ensuite (une fiche désactivée par un admin n'est pas republiée). Sur un flux **complet** (`--full`, ou moins de `--limit` produits récupérés ; et au moins un produit), les fiches du fournisseur absentes du flux sont désactivées (`deactivated` au bilan). Un flux à `--limit` pile peut être tronqué : rien n'est désactivé. Une fiche réapparue dans le flux reste désactivée : la réactiver à la main. **Garde-fou** : seul Makito annonce le total de son catalogue ; pour les autres, un JSON valide mais amputé ne se distingue pas d'un catalogue réduit. Si plus de 10 fiches **et** plus de 20 % des fiches actives du fournisseur devaient être désactivées d'un coup (`massDeactivation` dans `config/supplier_feeds.ts`), rien n'est désactivé, le bilan l'indique (`deactivationSkipped`) et la commande sort en code 1 ; après vérification, relancer avec `--allow-mass-deactivation`.
- **Une transaction par produit** : une fiche invalide est comptée en échec (bilan) sans bloquer les autres.
- Traduction dans la langue du flux (`is_auto = false`), `source_locale` = cette langue.
- Variantes, paliers et marquage via `ProductVariantService` / `ProductMarkingService`, avec la sémantique « remplace l'ensemble » des formulaires fournisseur. Les paliers propres à une variante ne sont écrits que s'ils diffèrent de ceux de la fiche. `price_min` / `price_max` sont recalculés.
- Colonnes dérivées recalculées comme ailleurs : `origin_zone` (`ProductOriginService`), `is_eco` (`ProductEcoService`, en tenant compte des labels éco saisis au back-office), `stock_status` (`ProductStockService` : stock > 0 → `in_stock`, 0 → `out_of_stock`, inconnu → `null`).
- Réindexation Meilisearch par l'événement `ProductChanged`, jamais d'appel direct.
- **Images** : au plus 5 par produit (galerie puis images de variantes). L'URL d'origine est gardée dans `product_images.source_url`. Par défaut l'URL fournisseur est aussi l'URL affichée (`storage_object_id` nul). Avec `--store-images`, chaque image passe par `StorageService.storeContent`, **sauf** si elle a déjà été copiée pour cette fiche (même `source_url`) : l'objet existant est réutilisé, sans re-téléchargement. Un téléchargement en échec (timeout, 5xx) laisse la galerie existante **intacte** (le prochain import réessaie) ; une réponse qui n'est pas une image est seulement écartée. Une galerie modifiée est remplacée dans la transaction : nouvelles lignes d'abord, puis `release` des anciens objets (un objet dédoublonné encore référencé n'est jamais libéré), et purge après commit.

### Rapprochement des référentiels

Les libellés bruts des fournisseurs sont rapprochés des slugs, noms traduits et `synonyms` existants, par **mots entiers**, sans tenir compte de la casse, des accents ni des pluriels simples. **Rien n'est inventé** : ce qui n'est pas reconnu reste brut.

| Donnée             | Règle                                                                                                        | Non reconnu                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Catégorie          | Score cumulé des libellés reconnus dans « catégorie fournisseur + nom produit » ; sous-catégorie prioritaire | Catégorie `non-classe` (« Non classé »), listée au bilan |
| Couleur            | Libellé le plus long : une nuance (`color-shade`, ex. « Bleu marine 02 ») entraîne sa famille (`color`)      | Variante sans valeur couleur                             |
| Matière            | Toutes les matières reconnues                                                                                | Ignorée                                                  |
| Technique marquage | Libellé le plus long                                                                                         | Technique ignorée, listée au bilan                       |

Pour améliorer le rapprochement, on enrichit les `synonyms` des référentiels (back-office) : le prochain import en profite.

## PF Concept

Manuel « Data feeds » v3.6.5. Base `https://www.pfconcept.com/portal/datafeed/`.

| Flux                               | Accès  | Usage                                                                          |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `productfeed_fr_v3.json` (~200 Mo) | public | Un _model_ = un produit, un _item_ = une déclinaison                           |
| `pricefeed_<code>_v3.json`         | compte | `scales[].scale[]` : `priceBar` (quantité) / `nettPrice` ; `promotion` ignorée |
| `stockfeed_<code>_v3.json`         | compte | `stockDirect`                                                                  |
| `printdata_cfr1_fr_v3.json`        | public | `printfeedrefs[].ref` → `printFeedRows` : emplacement, technique, taille       |
| `printpricefeed_<code>_v3.json`    | compte | Prix d'appel par `printCode` : première taille de logo, une couleur            |

- Images : `https://images.pfconcept.com/ProductImages_All/JPG/1600x1600/<fichier>`. `imageMain` → principale, `imageMood*` / `imageModel` / `imageGroup` → ambiance, `imageLogo*` → marquée.
- `--limit` s'applique aux _models_ **avant** la jointure avec les autres flux.
- Pays d'origine `PRC` → `CN`. Le code douane est conservé tel quel (chiffres seulement, 10 au plus) : retirer les zéros de fin corromprait les codes significatifs (`8471300000` → `84713`).
- Prix de la fiche : la grille **entière** de l'article le moins cher (prix d'appel, puis prix au plus grand palier). Les grilles ne sont jamais mélangées palier par palier ; un article à grille différente garde ses propres paliers.

## Passot Innovation (PiDesign)

Doc « PiDesign.eu API » v1.0.3. Base `https://www.pidesign.eu/<langue>/rest/V1/`, en-tête `PI-API-KEY`.

| Route                 | Usage                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog/products`    | `configurable` = fiche parente, `simple` = déclinaison, reliées par `main_sku` (sinon préfixe avant `#`)                                 |
| `catalog/prices`      | `tier_prices[]` (`qty`, `value`) par SKU ; prix de la fiche = ceux du parent s'il en a, sinon la grille de la déclinaison la moins chère |
| `catalog/stock`       | `quantity` par SKU                                                                                                                       |
| `customization/zones` | Zone = position, méthode = technique (`order_fee` = frais fixes, `prices` = paliers) ; méthodes express `is_priority` ignorées           |

- Images : `https://media.pidesign.eu/media/catalog/product<file>`.
- Les SKU de couleur « Echantillon » (échantillons) ne sont pas importés comme déclinaisons.
- `catalogue_status` `DES` / `ANR` ou option `FDS` → fin de série ; option « Nouveautés » → nouveauté.
- `categories` (liste de rubriques) → catégorie fournisseur brute.

## Inspirion (LEO API)

Doc en ligne `https://leoapi.inspirion.eu/documentation`. Base `https://leoapi.inspirion.eu`, en-tête `X-Gateway-API-Key` (clé client ; une clé partenaire utilise un autre en-tête et n'a pas accès aux prix).

| Route                                | Usage                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `api/v2/products?language=<langue>`  | Sans pagination. `sku` = fiche, `variants[].article_id` = déclinaison (`colour`, `ean`, `images_300`…)        |
| `api/v2/pricelist`                   | `pricelist[]` par `article_id` : `bulk_volume` (quantité) / `price` (prix du compte) ; `catalog_price` ignoré |
| `api/v1/stock`                       | `stock_france` par `article_id`                                                                               |
| `api/v1/products/categories`         | « rubrique parente > rubrique » traduites → catégorie fournisseur brute                                       |
| `api/v1/printdata?language=<langue>` | Position d'impression = position ; méthode = technique, décrite par son code d'impression par défaut          |
| `api/v2/print-prices`                | Par `printcode` : `setup` (frais fixes) et `pricelist[]` (`quantity` / `price`)                               |
| `api/v2/delivery-time`               | Délai d'expédition en jours ouvrés : le plus court avec marquage, sinon sans marquage                         |

- Galerie : images 300 px de la première déclinaison, puis images de détail de la fiche.
- Conditionnement : poids brut unitaire (`weight`), carton `pu` (quantité, dimensions, poids brut), converti selon l'unité annoncée.
- `commodity_code` (`7323 9400 000`) → code douane sans espaces, 10 chiffres au plus. Les balises HTML des descriptions sont retirées.
- Le mapping est écrit **d'après la documentation et ses exemples** : au 2026-11-20 la clé `INSPIRION_API_KEY` fournie est refusée par l'API (`401 Invalid API key`), il n'a donc pas pu être validé sur le flux réel.

## Makito

« Makito's Products API Docs » v1.06. Base `https://data.makito.es/api`. `POST /login` (`MAKITO_EMAIL` / `MAKITO_PASSWORD`) renvoie le jeton, envoyé ensuite en `Authorization: Bearer`. La doc annonce un champ `token` ; l'API réelle le renvoie dans `msg` (`{ "status": 1, "msg": "<id>|<jeton>" }`) : les deux sont acceptés.

Langues : `fr` → 4, `en` → 2, `de` → 6, `es` → 1. Seul `/products` est paginé (1 000 fiches par page) ; les autres routes renvoient le catalogue entier, **lentement** (jusqu'à 2 min par appel, ~15 min pour tout le catalogue) : elles sont appelées l'une après l'autre et mises en cache.

| Route                                       | Usage                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `products?page=&per_page=`                  | `ref` = fiche ; `intrastat`, `country_of_origin`, `brand`, poids (g), carton maître `ptc_*` (cm, kg)                        |
| `descriptionslang/<langue>`                 | `type` (« Foulard ») préfixe le nom de modèle (« Betty ») ; `comp` = matière ; `info` complète la description               |
| `descriptionextlang/<langue>`               | `desc` + `commercial_desc` → description                                                                                    |
| `keywords/<langue>`, `categories/<langue>`  | Mots-clés ; rubriques → catégorie brute (« Nouveautés » → nouveauté, « Destockage » / « Outlet » → fin de série)            |
| `variants`, `colors/<langue>`               | `matnr` = SKU de déclinaison ; libellé couleur + taille (sauf `S/T`, sans taille) ; `img100`                                |
| `stockVariants`                             | Une ligne par date : seul `stock_availability = immediately` compte ; `"24.000"` = 24 000 (points de milliers)              |
| `prices`                                    | `section_n` / `price_n` : seuils **bas** (`-500, 500, 2000` = dès 1, 500, 2 000 pièces)                                     |
| `imgResources`                              | Dossier `principal` → principale, `bodegones` → ambiance, `detalles` → vue ; `variantes`, `areas`, `cajas` ignorés          |
| `markings`, `markingsTranslations/<langue>` | `print_area_id` = position (libellé traduit, sinon « Zone <id> ») ; `width` / `height` en cm                                |
| `markingTechniques/<langue>`                | Libellé de la technique par `technique_ref` (balises HTML retirées)                                                         |
| `markingTechniquesPrices`                   | `cliche` = frais fixes ; `section_n` lues comme des bornes **hautes** (`250, 500, 2000` = dès 1, 251, 501) ; prix 1 couleur |
| `leadtimes`                                 | Délai de marquage zone export (`EXP`, jours) le plus court des techniques de la fiche                                       |

- L'API ne fournit pas de code EAN : `gtin` reste vide.
- Un login refusé arrête l'import avant tout autre appel. Un catalogue entier (`--full`) doit compter autant de fiches que le `total` annoncé par `page_info` : sinon (page vide, pagination absente) l'import échoue, pour ne pas désactiver les fiches « absentes ».
- Plusieurs images `main = 1` pour une fiche : la première seule est principale, les suivantes sont des vues.
- **Hypothèse à confirmer avec Makito** : la doc ne décrit pas le sens de `section_n` pour les prix de marquage. La lecture « bornes hautes » est déduite des données (grilles `250, 500, 2000…`, grille unique `100000`) ; si ce sont des seuils bas comme pour `prices`, les paliers de marquage sont décalés d'un cran.
- La doc ne précise pas si `prices` renvoie le tarif catalogue ou le prix net du compte : à confirmer avec Makito avant d'utiliser ces prix pour un chiffrage.

## Écrire un connecteur

Un connecteur ne fait que **lire** les flux (authentification, pagination, flux annexes facultatifs). La logique de données vit à côté, en **fonctions pures exportées et testées une à une**, sans boucle imbriquée :

- `<fournisseur>_feed_index.ts` : une fonction par flux annexe (`indexMakitoStock`, `indexInspirionPrices`…), assemblées par `build<Fournisseur>Index` ;
- `<fournisseur>_feed_mapper.ts` : une fonction par morceau de fiche (déclinaison, conditionnement, marquage…), assemblées par `normalize<Fournisseur>Product`.

Ce qui sert à plusieurs fournisseurs va dans `shared/helpers/supplier_feed.ts` (parsing, conversions d'unités, `sortedPriceTiers`, `indexBy`, `groupBy`, `lowestByKey`, `sumByKey`) ou `feed_tree.ts` (parcours des nœuds) ; ce qui encode le format d'un seul fournisseur reste dans ses modules.

## Tests

Sans réseau, sur des fixtures **anonymisées à prix fictifs** (`tests/fixtures/supplier_feed/`) qui reproduisent la structure réelle des flux. Le faux client HTTP et le connecteur en mémoire sont dans `tests/utils/supplier_feed.ts`.

- `tests/unit/supplier_feed_connectors.spec.ts` : utilitaires, rapprochement, paliers numérotés et points de milliers, normalisation PF Concept, Passot, Inspirion et Makito (login, pagination, catalogue incomplet, flux annexes manquants signalés), connecteur non configuré.
- `tests/unit/supplier_feed_helpers.spec.ts` : utilitaires communs (`stripHtml`, conversions d'unités, `sortedPriceTiers`, `indexBy`, `groupBy`, agrégats par clé).
- `tests/unit/supplier_feed_inspirion.spec.ts`, `tests/unit/supplier_feed_makito.spec.ts` : chaque fonction d'index et de traduction, une à une (cas nominal et valeurs de repli).
- `tests/unit/supplier_http_client.spec.ts` : client réel (`fetch` simulé, dossier temporaire). Requêtes : en-têtes, nouvel essai sur 5xx et panne réseau, arrêt immédiat sur 4xx, réponse illisible, secrets masqués dans les messages, `postJson`, `getBuffer`. Cache disque : réutilisation, `--refresh`, péremption, rattachement au compte, téléchargement coupé puis retenté, réponse illisible.
- `tests/functional/supplier_feed_import.spec.ts` : création, idempotence, couleurs (nuance + famille), techniques, catégorie de repli, dry-run sans écriture, échec isolé, activation et désactivation (flux complet, import intégral, flux tronqué), import intégral annulé si un flux annexe manque, slug unique, label éco conservé, images copiées (réutilisation, échec de téléchargement), registre.
