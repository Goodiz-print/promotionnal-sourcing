# Produits sponsorisés (enchères au clic)

> Date : 2026-11-11

Les fournisseurs peuvent sponsoriser un produit pour le faire remonter, avec la
mention « Sponsorisé », en tête du catalogue, en bas des fiches produit de la même
catégorie et sur l'accueil. Ils paient au clic, depuis un portefeuille prépayé.
Détail : [`docs/ads.md`](../ads.md).

- **Ciblage par pertinence** : un produit sponsorisé n'apparaît que s'il respecte
  le terme cherché et tous les filtres actifs. Le ET fiable n'est jamais contourné.
- **Enchère au second prix** : classement par enchère maximale, un emplacement par
  organisation, prix payé = enchère suivante + 1 centime (plancher 0,10 €).
- **Campagnes** (`ad_campaigns`) : un produit, une enchère maximale par clic, un
  budget quotidien, une période ; statuts `active`, `paused`, `suspended`.
- **Clic** : lien signé `GET /:locale/ads/click/:id`, débit en transaction. Non
  facturés : doublon du même visiteur sous 24 h, membre de l'organisation
  annonceuse, équipe plateforme, robots, lien altéré.
- **Portefeuille** (`ad_wallets`, `ad_wallet_transactions`) : recharge par Stripe
  Checkout, crédit à réception du webhook signé `POST /webhooks/stripe`
  (idempotent). Sans `STRIPE_SECRET_KEY`, la recharge en ligne est désactivée.
- **Espace fournisseur** : `/:locale/supplier/ads` (solde, campagnes, affichages,
  clics, dépense, mouvements), création, modification, pause, suppression. Ability
  `canManageAds` (owner/admin d'une organisation fournisseuse).
- **Back-office** : `/:locale/admin/ads` (droit `ads.manage`) — supervision,
  suspension, ajustement manuel d'un portefeuille ; actions auditées.
- **Recherche** : `id` devient filtrable dans l'index Meilisearch
  (`ProductSearchFilter.ids`) ; lancer `node ace search:reindex` après déploiement.
- **Configuration** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optionnelles) ;
  dépendance `stripe`.
- **Tests** : `tests/unit/ad_auction.spec.ts`, `tests/functional/ads.spec.ts`.
