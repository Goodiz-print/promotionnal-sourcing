# Connecteurs de flux fournisseurs

Import des **catalogues réels** des fournisseurs (produits, déclinaisons, prix nets, stock, marquage, images) pour peupler les bases de **dev / staging** avec des données réalistes : `node ace supplier:import`.

> Les identifiants sont des **accès réels** et les prix importés sont les **prix nets confidentiels du compte**. Ils ne vont que dans `.env` et dans une base de dev/staging, jamais dans le code, les fixtures, la doc ni un commit.

## Usage

```sh
node ace supplier:import pfconcept --limit=20 --dry-run   # récupère et normalise, n'écrit rien
node ace supplier:import pfconcept --limit=200            # import (200 produits par défaut)
node ace supplier:import passot --locale=en
node ace supplier:import all                              # les connecteurs configurés, les autres sont ignorés
```

| Option           | Effet                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `--limit`        | Nombre maximal de produits (modèles) par fournisseur, 200 par défaut                         |
| `--locale`       | Langue du flux : `fr` (défaut), `en`, `de`, `es`                                             |
| `--dry-run`      | Bilan (produits, catégories et techniques non reconnues) sans écriture                       |
| `--store-images` | Copie les images dans Cellar (clé sha256, dédoublonnage) au lieu de garder l'URL fournisseur |
| `--skip-images`  | Ne touche pas à la galerie                                                                   |
| `--force`        | Autorise l'exécution avec `NODE_ENV=production` (refusée sinon)                              |

Relançable sans risque : un second import met les fiches à jour, sans doublon.

## Configuration (`.env`)

| Variable                   | Fournisseur | Rôle                                                                                                  |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `PFCONCEPT_FEED_CODE`      | PF Concept  | Code distributeur dans les URLs des flux prix / stock / prix de marquage (`pricefeed_<code>_v3.json`) |
| `PASSOT_API_KEY`           | Passot      | En-tête `PI-API-KEY` de l'API PiDesign                                                                |
| `INSPIRION_API_KEY`        | Inspirion   | Réservé (connecteur non implémenté)                                                                   |
| `AXPOL_API_KEY`            | Axpol       | Réservé (connecteur non implémenté)                                                                   |
| `SUPPLIER_FEED_TIMEOUT_MS` | tous        | Timeout HTTP, 120 s par défaut (les flux PF Concept pèsent jusqu'à ~200 Mo)                           |
| `SUPPLIER_FEED_USER_AGENT` | tous        | User-Agent annoncé, `GoodizprintSourcing/1.0` par défaut                                              |

Toutes sont optionnelles (`Env.schema.secret.optional()`) : sans elles l'application démarre, et le connecteur concerné lève `SupplierConnectorNotConfiguredException` à l'usage.

## Architecture

```
commands/supplier_import.ts             commande ace (DI sur run())
app/services/supplier_feed/
  supplier_connector.ts                 classe abstraite : key, identity, isConfigured(), fetchCatalogue()
  pfconcept_connector.ts                PF Concept (flux JSON v3)
  passot_connector.ts                   Passot / PiDesign (API REST Magento)
  inspirion_connector.ts, axpol_connector.ts   squelettes (doc fournisseur en attente)
  supplier_connector_registry.ts        résolution par clé
  supplier_http_client.ts               fetch + timeout + nouvel essai sur 5xx ; URLs masquées dans les logs
  feed_tree.ts                          parcours tolérant des JSON (nœuds trouvés par leurs clés)
  supplier_reference_service.ts         référentiels (catégories, couleurs, matières, techniques) + fiche fournisseur
  supplier_catalogue_importer.ts        persistance
shared/types/supplier_feed.ts           NormalizedProduct & co
shared/helpers/supplier_feed.ts         parsing (« 17,5 », pays, cm→mm, redactUrl…)
shared/helpers/reference_matcher.ts     rapprochement libellé brut → référentiel
```

Un connecteur **ne fait que lire** : il traduit le flux en `NormalizedProduct[]`. Tout l'écrit en base passe par `SupplierCatalogueImporter`, commun à tous les fournisseurs.

### Persistance

- **Fournisseur** créé / mis à jour par slug (`pf-concept`, `passot-innovation`, `inspirion`, `axpol`), sans organisation rattachée.
- **Produit** rapproché par `(supplier_id, external_id)` : la colonne `products.external_id` (code modèle PF Concept, SKU parent Passot) porte un index unique. Slug `<fournisseur>-<external_id>`.
- **Une transaction par produit** : une fiche invalide est comptée en échec (bilan) sans bloquer les autres.
- Traduction dans la langue du flux (`is_auto = false`), `source_locale` = cette langue.
- Variantes, paliers et marquage via `ProductVariantService` / `ProductMarkingService`, avec la sémantique « remplace l'ensemble » des formulaires fournisseur. Les paliers propres à une variante ne sont écrits que s'ils diffèrent de ceux de la fiche. `price_min` / `price_max` sont recalculés.
- Colonnes dérivées recalculées comme ailleurs : `origin_zone` (`ProductOriginService`), `is_eco` (`ProductEcoService`), `stock_status` (`ProductStockService` : stock > 0 → `in_stock`, 0 → `out_of_stock`, inconnu → `null`).
- Réindexation Meilisearch par l'événement `ProductChanged`, jamais d'appel direct.
- **Images** : au plus 5 par produit (galerie puis images de variantes). Par défaut l'URL fournisseur est conservée (`storage_object_id` nul). Avec `--store-images`, chaque image passe par `StorageService.storeContent`. Une galerie modifiée est remplacée dans la transaction : nouvelles lignes d'abord, puis `release` des anciens objets (un objet dédoublonné encore référencé n'est jamais libéré), et purge après commit.

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
- Un flux annexe en échec (prix, stock, marquage) est journalisé et l'import continue sans ces données.
- Pays d'origine `PRC` → `CN`. Le code douane est tronqué de ses zéros de fin.

## Passot Innovation (PiDesign)

Doc « PiDesign.eu API » v1.0.3. Base `https://www.pidesign.eu/<langue>/rest/V1/`, en-tête `PI-API-KEY`.

| Route                 | Usage                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `catalog/products`    | `configurable` = fiche parente, `simple` = déclinaison, reliées par `main_sku` (sinon préfixe avant `#`)                       |
| `catalog/prices`      | `tier_prices[]` (`qty`, `value`) par SKU de déclinaison ; prix de la fiche = le moins cher par palier                          |
| `catalog/stock`       | `quantity` par SKU                                                                                                             |
| `customization/zones` | Zone = position, méthode = technique (`order_fee` = frais fixes, `prices` = paliers) ; méthodes express `is_priority` ignorées |

- Images : `https://media.pidesign.eu/media/catalog/product<file>`.
- Les SKU de couleur « Echantillon » (échantillons) ne sont pas importés comme déclinaisons.
- `catalogue_status` `DES` / `ANR` ou option `FDS` → fin de série ; option « Nouveautés » → nouveauté.
- `categories` (liste de rubriques) → catégorie fournisseur brute.

## Inspirion, Axpol

Squelettes seulement : `fetchCatalogue` lève `SupplierConnectorNotImplementedException`. Le mapping sera écrit à réception de la documentation de la LEO API (Inspirion) et de l'archive Axpol avec son mot de passe.

## Tests

Sans réseau, sur des fixtures **anonymisées à prix fictifs** (`tests/fixtures/supplier_feed/`) qui reproduisent la structure réelle des flux. Le faux client HTTP et le connecteur en mémoire sont dans `tests/utils/supplier_feed.ts`.

- `tests/unit/supplier_feed_connectors.spec.ts` : utilitaires, rapprochement, normalisation PF Concept et Passot, connecteur non configuré.
- `tests/functional/supplier_feed_import.spec.ts` : création, idempotence, couleurs (nuance + famille), techniques, catégorie de repli, dry-run, échec isolé, registre.
