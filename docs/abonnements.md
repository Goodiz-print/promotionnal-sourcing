# Abonnements fournisseurs

Formules (`SUBSCRIPTION_PLANS`, `shared/types/organization.ts`) : **Gratuit**
(`free`), **Business** (`business`, 250 € HT / mois), **Premium** (`premium`,
500 € HT / mois). La grille des droits vient de l'issue #214 ; elle est affichée
sur la page tarifs (`SUBSCRIPTION_FEATURES`, `shared/types/subscription.ts`).

Ce document couvre la **donnée d'abonnement** et la **souscription en ligne**
(issue #215). La saisie manuelle par l'admin, le job d'expiration et les
mails relèvent de #214 et #237 et viendront se brancher sur le même service.

## Donnée

| Table                                 | Rôle                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `organization_subscriptions`          | Une ligne par abonnement : formule, statut, origine, dates, identifiant Stripe. Historique conservé. |
| `organizations.subscription_plan`     | Formule **courante** dénormalisée. Écrite **uniquement** par `SubscriptionService`.                  |
| `billing_profiles.stripe_customer_id` | Client Stripe de l'organisation, créé à la première souscription.                                    |
| `stripe_webhook_events`               | Identifiants des notifications Stripe d'abonnement déjà traitées (idempotence), purgés à 30 jours.   |

- **Statuts** (`SUBSCRIPTION_STATUSES`) : `scheduled`, `pending`, `active`,
  `past_due`, `expired`, `cancelled`. Seuls `active` et `past_due` ouvrent les
  droits de la formule.
- **Un seul abonnement en cours** par organisation : index unique partiel
  `organization_subscriptions_one_current_idx` sur `organization_id` pour
  `status IN ('active', 'past_due')`.
- **Origine** (`manual`, `stripe`) : colonne texte, validée côté application ;
  une nouvelle origine ne demande pas de migration.
- **Formule** : `business` ou `premium` (contrainte `CHECK`). `free` n'est jamais
  un abonnement : c'est l'absence d'abonnement en cours.

## Règle « abonné »

`SubscriptionService` est le seul point du code qui répond à « abonné ou non » :

- `current(organizationId)` : abonnement en cours (`active` ou `past_due`) ;
- `blocking(organizationId)` : abonnement en cours **ou** premier paiement en
  validation (`pending`) — ce qui interdit une nouvelle souscription ;
- `isSubscribed(organizationId)` : la règle, évaluée **à la lecture** ;
- `refreshPlan(organizationId, trx)` : recalcule `organizations.subscription_plan`.

## Souscription en ligne (Stripe Billing)

Abstraction `SubscriptionBillingGateway` (`app/services/subscriptions/`), liée
dans `providers/subscription_provider.ts` : `StripeSubscriptionBillingGateway`
quand la configuration est complète, `NullSubscriptionBillingGateway` sinon.

1. **Page tarifs** `GET /:locale/supplier/subscription` (`supplier.subscription.show`) :
   formule courante, statut, échéance, grille des formules.
2. **Souscrire** `POST /:locale/supplier/subscription/checkout` (`plan`) : crée le
   client Stripe s'il n'existe pas (profil de facturation verrouillé : jamais deux
   clients), puis ouvre Stripe Checkout en mode `subscription`. Refusé si un
   abonnement est déjà en cours (le changement de formule passe par le portail)
   ou si un premier paiement est encore en validation (`pending` : 3-D Secure,
   prélèvement), qui pourrait encore aboutir.
3. **Portail** `POST /:locale/supplier/subscription/portal` : portail de
   facturation Stripe (changement de formule, résiliation, moyen de paiement,
   factures). Retour sur la page tarifs.
4. **Notifications** `POST /webhooks/stripe` (partagée avec les recharges
   publicitaires, cf. `docs/ads.md`) : les événements `customer.subscription.*` et
   `invoice.*` déclenchent la mise à jour.

Accès : ability `canManageSubscription` (owner/admin d'une organisation
fournisseuse) ; entrée de menu « Abonnement » pour ces rôles.

### Traitement d'une notification

- Signature vérifiée sur le corps brut ; invalide → `400`.
- Une notification déjà présente dans `stripe_webhook_events` est ignorée sans
  appel à Stripe. Sinon son identifiant est inséré **dans la même transaction**
  que la mise à jour : un traitement en échec annule l'insertion et Stripe
  renvoie la notification (`StripeWebhookEventService`).
- L'abonnement est **relu** chez Stripe (`subscriptions.retrieve`) plutôt que
  déduit du contenu de la notification : l'ordre d'arrivée n'importe pas. La
  relecture a lieu **avant** la transaction, qui ne reste pas ouverte pendant
  l'appel réseau.
- La ligne locale est retrouvée par `stripe_subscription_id` (unique) : mise à
  jour, jamais dupliquée. L'organisation vient de la métadonnée
  `organizationId` de l'abonnement, à défaut du profil de facturation qui porte
  le client.
- Un abonnement en ligne qui devient courant clôt (`cancelled`) un éventuel
  abonnement **manuel** encore en cours : un seul à la fois.
- **Doublon en ligne** : si un autre abonnement **Stripe** est déjà en cours
  (deux pages de souscription payées en parallèle), il n'est jamais clos
  localement seulement — Stripe continuerait de le facturer. L'abonnement en
  place est relu chez Stripe :
  - s'il n'y est plus en cours (résiliation dont la notification n'est pas
    encore arrivée), il est clos et le nouveau le remplace ;
  - sinon il est gardé, et le nouveau est **résilié immédiatement chez Stripe**
    (sans proratisation) puis enregistré `cancelled`. Chaque **administrateur
    de la plateforme** (`platform_role = 'admin'`) reçoit une notification in-app
    (`subscription.duplicate_cancelled`, lien vers la fiche admin de
    l'organisation) : le paiement du doublon est à **rembourser depuis le
    tableau de bord Stripe**. Un log `error` (`duplicate online subscription
cancelled at Stripe`) le trace aussi. La notification part dès la
    résiliation faite (`SubscriptionAlertService`) ; son échec est loggé sans
    rien annuler.

  Si la résiliation échoue, toute la transaction est annulée et Stripe renvoie
  la notification.

- **Souscription en ligne désactivée** (variables retirées alors que des
  abonnements tournent encore chez Stripe) : les notifications d'abonnement sont
  ignorées et un `warn` le signale — la formule ne suit plus Stripe tant que la
  configuration n'est pas rétablie.

### Rétention

Le job `PurgeStripeWebhookEventsJob` (planning `purge-stripe-webhook-events`,
chaque nuit à 4 h 35, heure de Paris, lançable depuis l'admin de la queue)
supprime les lignes de `stripe_webhook_events` de plus de 30 jours
(`STRIPE_WEBHOOK_EVENT_RETENTION_DAYS`). Stripe ne renvoie plus une
notification après 3 jours : la ligne ne sert alors plus à l'idempotence.

### Statut Stripe → statut plateforme (`statusFromProvider`)

| Stripe                                                        | Plateforme  | Formule                            |
| ------------------------------------------------------------- | ----------- | ---------------------------------- |
| `active`, `trialing`                                          | `active`    | accordée                           |
| `past_due`                                                    | `past_due`  | **conservée** pendant les relances |
| `incomplete`                                                  | `pending`   | aucune                             |
| `unpaid`, `canceled`, `incomplete_expired`, `paused`, inconnu | `cancelled` | retour en `free`                   |

En cas d'impayé, la formule suit donc Stripe : conservée pendant les relances
automatiques, retirée quand Stripe abandonne (abonnement `unpaid` ou `canceled`
selon le réglage « Gérer les paiements échoués » du tableau de bord). Si
l'échéance est finalement réglée, la notification suivante rétablit la formule.

Une résiliation demandée dans le portail « à la fin de la période » garde la
formule (`cancel_at_period_end`, affiché sur la page) jusqu'à la notification
`customer.subscription.deleted`.

## Configuration

Variables (optionnelles, `start/env.ts`, `.env.example`) :

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` : communes avec les recharges publicitaires ;
- `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_PREMIUM` : identifiants des prix récurrents mensuels.

Sans l'une d'elles, la souscription en ligne est désactivée (la page tarifs
l'indique) ; c'est le cas en dev, test et CI.

Côté tableau de bord Stripe :

1. Créer un produit par formule avec un **prix récurrent mensuel** (250 € et 500 € HT) ; reporter les `price_…`.
2. Configurer le **portail client** : autoriser le changement entre les deux prix,
   la résiliation et la mise à jour du moyen de paiement ; activer l'historique des factures.
3. Ajouter au webhook `https://<domaine>/webhooks/stripe` les événements
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid` et `invoice.payment_failed`
   (en plus de `checkout.session.completed` pour les recharges).
4. Régler les relances des paiements échoués (Smart Retries) et l'issue finale
   (résilier ou marquer impayé) : elle décide du retour en gratuit.

## Tests

- `tests/unit/subscription_status.spec.ts` : correspondance des statuts, types
  de notification, prestataire inerte.
- `tests/functional/subscriptions.spec.ts` : page tarifs, droits, création et
  réutilisation du client, page de souscription, portail, notifications
  (activation, changement de formule, impayé, résiliation, rejeu, signature
  invalide, échec puis renvoi, contrainte d'unicité, paiement en validation,
  doublon en ligne, remplacement d'un abonnement déjà résilié), purge. Prestataire factice :
  `tests/utils/fake_subscription_billing_gateway.ts`.
