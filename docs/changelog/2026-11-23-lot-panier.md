# Lot de panier sur les demandes de devis

> Date : 2026-11-23

Issue #229, socle technique de la vue groupée de « Mes demandes » (#228). Aucun
changement d'écran.

- **Colonne `rfqs.batch_id`** (uuid nullable, indexée) : migration
  `1794000000039_add_batch_id_to_rfqs`, avec `down()`.
- **Validation du panier** (`POST /quote-cart/checkout`, `QuoteCartService#checkout`) :
  un uuid est tiré une fois par validation et posé sur toutes les demandes créées
  (une par fournisseur). Deux validations donnent deux lots distincts.
- **Demande créée seule** (`RfqService#create` hors panier, « en un clic ») :
  `batch_id` reste `null`. Le lot passe par `NewRfqData` (données internes de
  `RfqService#create`), pas par `CreateRfqData` (forme d'une requête HTTP) : un
  `batchId` envoyé à `POST /rfqs` est ignoré.
- **Exposition** : `batchId: string | null` dans `RfqType` (et donc
  `RfqDetailType`), via `RfqTransformer`. Le côté fournisseur (`SupplierRfqType`)
  ne le reçoit pas.
- **Tests** : même lot pour une validation à deux fournisseurs, lots distincts
  pour deux validations, `null` pour une demande créée seule
  (`tests/functional/quote_cart.spec.ts`, `tests/functional/rfqs.spec.ts`), lot
  forgé ignoré à la création (`tests/functional/rfq_screens.spec.ts`) ; spec
  unitaire de `RfqTransformer` (forme exacte, aucun id interne exposé).
