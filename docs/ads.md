# Produits sponsorisés

Un fournisseur paie **au clic** (CPC) pour faire remonter un de ses produits en
tête du catalogue, en bas des fiches produit de la même catégorie et sur
l'accueil. Le fonctionnement reprend les principes d'une régie d'annonces de
recherche : enchère, budget, facturation au clic, libellé « Sponsorisé ».

## Principes

- **Pertinence seule.** Pas de mots-clés à acheter. Un produit sponsorisé
  n'apparaît dans le catalogue que s'il respecte le terme cherché **et tous les
  filtres actifs**. La sponsorisation fait remonter un produit pertinent, elle ne
  contourne jamais le ET fiable (`docs/product-context.md`).
- **Transparence.** Chaque vignette porte le badge « Sponsorisé » et son lien
  `rel="sponsored nofollow"`. Les produits sponsorisés s'ajoutent en tête : ils ne
  remplacent ni ne réordonnent les résultats organiques.
- **Prépayé.** Un clic débite le portefeuille publicitaire de l'organisation. Pas
  de crédit, pas de solde négatif (contrainte `CHECK` en base).
- **Centimes entiers.** Tous les montants sont stockés et calculés en centimes
  d'euro (`shared/types/ads.ts`) ; les formulaires saisissent des euros.

## Modèle de données

| Table                    | Rôle                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `ad_wallets`             | Portefeuille d'une organisation (un par organisation), `balance_cents`.                       |
| `ad_wallet_transactions` | Journal en ajout seul : `top_up`, `adjustment`, `click`. `external_reference` unique.         |
| `ad_campaigns`           | Un produit (unique), `max_cpc_cents`, `daily_budget_cents`, `starts_on`, `ends_on`, `status`. |
| `ad_clicks`              | Chaque clic, facturé ou non (`billed`, `unbilled_reason`), `visitor_hash`, `placement`.       |
| `ad_impressions`         | Compteur d'affichages par campagne, jour et emplacement.                                      |

Statuts d'une campagne : `active`, `paused` (par le fournisseur), `suspended`
(par l'équipe plateforme, non réactivable par le fournisseur).

## Diffusion

1. **Éligibilité** (`AdAuctionService.eligible`) — une campagne participe si elle
   est `active`, dans sa période, que son produit est visible du catalogue, que le
   portefeuille couvre un clic à l'enchère maximale et que le budget du jour laisse
   la place d'un clic à l'enchère maximale (une campagne ne dépasse donc jamais son
   budget quotidien).
2. **Pertinence** (`SponsoredProductService`) :
   - catalogue **avec terme** : `ProductSearchService.matching` interroge le moteur
     par **mots-clés seuls** (`semanticRatio: 0`) avec le filtre `id IN […]` et les
     filtres de la recherche, puis recharge depuis PostgreSQL. En hybride, tout
     produit « ressemble » un peu à la requête : rien ne serait écarté ;
   - catalogue **sans terme** : `ProductCatalogueService.matching`, mêmes filtres
     que la liste ;
   - fiche produit : même catégorie, hors produit consulté ;
   - accueil : pas de contexte, toutes les campagnes éligibles.
3. **Enchère** (`runAdAuction`, `shared/helpers/ad_auction.ts`) — second prix :
   classement par enchère décroissante (à égalité, la campagne la plus ancienne),
   **un seul emplacement par organisation**, et chaque gagnant paie l'enchère du
   suivant plus un centime, bornée par le prix plancher (`AD_MIN_CPC_CENTS`, 0,10 €)
   et par sa propre enchère maximale. Seul en lice, il paie le prix plancher.
4. **Affichage** — `AD_SLOTS` : 3 emplacements dans le catalogue (première page
   seulement), 4 sur la fiche produit, 4 sur l'accueil. Les affichages sont comptés
   (`AdImpressionService`, un `INSERT … ON CONFLICT`, n'échoue jamais).

Moteur de recherche indisponible : aucun produit sponsorisé sur une recherche par
terme (la page affiche déjà « recherche indisponible »).

## Clic et facturation

Le lien d'une vignette est une **URL signée** (`ads.click`, valable 12 h) qui porte
l'emplacement (`p`) et le prix fixé par l'enchère (`c`). `AdClickService.register` :

- lien altéré ou expiré, robot (User-Agent), campagne inconnue : redirection sans
  rien compter ;
- clic **non facturé** mais enregistré : même visiteur sur la même campagne dans
  les 24 h (`duplicate`), membre de l'organisation annonceuse
  (`own_organization`), équipe plateforme (`staff`), campagne arrêtée entre
  l'affichage et le clic (`inactive`), budget du jour épuisé (`budget`), solde
  insuffisant (`insufficient_funds`) ;
- clic **facturé** : débit du portefeuille et ligne de clic dans la même
  transaction, portefeuille verrouillé (`FOR UPDATE`).

Dans tous les cas le visiteur est redirigé vers la fiche. `visitor_hash` est un
HMAC (clé de l'application) du compte connecté, ou de l'IP et du navigateur :
aucune adresse IP n'est conservée.

## Portefeuille et paiement

- **Recharge en ligne** : Stripe Checkout (`StripeAdPaymentGateway`). La carte est
  saisie sur la page hébergée par Stripe ; le portefeuille n'est crédité qu'à
  réception du webhook signé `checkout.session.completed`
  (`POST /webhooks/stripe`, hors locale, exempté de CSRF), **jamais** au retour du
  navigateur. Le crédit est idempotent (`external_reference` = `stripe:<session>`).
- **Sans `STRIPE_SECRET_KEY`** (dev, test, CI) : `NullAdPaymentGateway`, le
  formulaire de recharge est remplacé par un message. L'équipe crédite alors les
  portefeuilles depuis le back-office.
- Abstraction : `AdPaymentGateway` (classe abstraite) liée dans
  `providers/ads_provider.ts`.

Variables : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optionnelles,
`start/env.ts`, `.env.example`). Côté Stripe, déclarer le webhook
`https://<domaine>/webhooks/stripe` pour l'événement `checkout.session.completed`.

Non traité à ce stade : TVA et facture de la recharge (à configurer côté Stripe ou
à émettre hors plateforme), remboursement d'un solde.

## Routes

| Méthode | Route                                 | Nom                          | Accès              |
| ------- | ------------------------------------- | ---------------------------- | ------------------ |
| GET     | `/:locale/ads/click/:id`              | `ads.click`                  | public, URL signée |
| GET     | `/:locale/supplier/ads`               | `supplier.ads.index`         | `canManageAds`     |
| GET     | `/:locale/supplier/ads/new`           | `supplier.ads.create`        | `canManageAds`     |
| POST    | `/:locale/supplier/ads`               | `supplier.ads.store`         | `canManageAds`     |
| GET     | `/:locale/supplier/ads/:id/edit`      | `supplier.ads.edit`          | `canManageAds`     |
| PATCH   | `/:locale/supplier/ads/:id`           | `supplier.ads.update`        | `canManageAds`     |
| PATCH   | `/:locale/supplier/ads/:id/status`    | `supplier.ads.status`        | `canManageAds`     |
| DELETE  | `/:locale/supplier/ads/:id`           | `supplier.ads.destroy`       | `canManageAds`     |
| POST    | `/:locale/supplier/ads/wallet/top-up` | `supplier.ads.wallet.top_up` | `canManageAds`     |
| GET     | `/:locale/admin/ads`                  | `admin.ads.index`            | droit `ads.manage` |
| POST    | `/:locale/admin/ads/:id/suspend`      | `admin.ads.suspend`          | droit `ads.manage` |
| POST    | `/:locale/admin/ads/:id/restore`      | `admin.ads.restore`          | droit `ads.manage` |
| POST    | `/:locale/admin/ads/wallets/adjust`   | `admin.ads.wallets.adjust`   | droit `ads.manage` |
| POST    | `/webhooks/stripe`                    | `webhooks.stripe`            | signature Stripe   |

`canManageAds` : owner ou admin d'une organisation fournisseuse (`supplier`,
`both`). `ads.manage` : rôle plateforme `admin`.

## Écrans

- **Fournisseur** (`supplier/ads/*`) : solde et recharge, campagnes avec
  affichages, clics et dépense, création / modification / pause / suppression,
  derniers mouvements du portefeuille. Entrée de menu « Produits sponsorisés ».
- **Back-office** (`admin/ads/index`) : toutes les campagnes, suspension /
  rétablissement (une campagne rétablie revient en pause), ajustement manuel d'un
  portefeuille avec motif. Actions tracées au journal d'audit
  (`ad_campaign.suspended`, `ad_campaign.restored`, `ad_wallet.adjusted`).
- **Public** : `SponsoredProducts` (`inertia/components/ads/`) en tête du
  catalogue, en bas de la fiche produit, et `SponsoredSection` sur l'accueil.

## Déploiement

- Migrations `1794000000014` à `1794000000018`.
- Le champ `id` devient filtrable dans l'index Meilisearch : lancer
  `node ace search:reindex` après le déploiement. D'ici là, les produits
  sponsorisés n'apparaissent pas sur une recherche par terme (la navigation par
  filtres, la fiche produit et l'accueil fonctionnent).

## Tests

`tests/unit/ad_auction.spec.ts` (enchère) et `tests/functional/ads.spec.ts`
(diffusion, clic facturé, campagnes, recharge, supervision). Le paiement est
remplacé par `tests/utils/fake_ad_payment_gateway.ts`.
