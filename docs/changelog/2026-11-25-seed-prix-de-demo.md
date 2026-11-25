# Seed : prix de démo pour le prix indicatif du mail de demande (#293)

> Date : 2026-11-25

Le seed de démo (`database/seeders/product_seeder.ts`) pose désormais une
grille de prix dégressive (`product_price_tiers`, paliers produit à
`variant_id` null, en EUR) sur 5 des 7 produits :

| Produit                       | Paliers (quantité → prix unitaire)                  |
| ----------------------------- | --------------------------------------------------- |
| `crayon-hb-bleu`              | 100 → 0,90 · 500 → 0,60 · 1000 → 0,45 · 5000 → 0,35 |
| `crayon-aquarelle-bleu`       | 50 → 1,40 · 250 → 1,00 · 1000 → 0,60                |
| `stylo-bille-bleu`            | 250 → 0,60 · 1000 → 0,35 · 5000 → 0,20              |
| `sac-coton-bleu`              | 30 → 3,20 · 100 → 2,40 · 500 → 1,50                 |
| `casquette-6-panneaux-marine` | 50 → 5,90 · 250 → 4,50 · 500 → 3,20                 |

`crayon-hb-rouge` et `stylo-bille-noir` restent **volontairement sans prix**
pour vérifier le cas « Pas de prix catalogue : à chiffrer ». Chez EuroGoods
(seul fournisseur de démo rattaché), le panier peut donc mêler une ligne
chiffrée (`crayon-hb-bleu`, casquette) et une ligne sans prix
(`crayon-hb-rouge`).

Le seed reste idempotent : la grille d'un produit est remplacée d'un bloc à
chaque exécution (aucun doublon), et un produit sans grille n'est pas touché.

Vérification de bout en bout : un panier validé crée des `rfq_items.specs` avec
`estimatedUnitPrice` / `estimatedTotal`, et le mail reçu par le fournisseur
affiche « Prix unitaire indicatif » et « Total indicatif », ou « Pas de prix
catalogue : à chiffrer » pour la ligne sans grille.

Tests : `tests/functional/catalogue.spec.ts` (grille posée, produits sans prix,
seed rejoué sans doublon).
