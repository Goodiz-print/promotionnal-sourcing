# Abonnements fournisseurs

Formules (`SUBSCRIPTION_PLANS`, `shared/types/organization.ts`) : **Gratuit**
(`free`), **Business** (`business`, 250 € HT / mois), **Premium** (`premium`,
500 € HT / mois). La grille des droits vient de l'issue #214 ; elle est affichée
sur la page tarifs (`SUBSCRIPTION_FEATURES`, `shared/types/subscription.ts`).

Ce document couvre la **donnée d'abonnement**, la **saisie manuelle par l'admin**
avec activation et expiration automatiques (#214) et la **souscription en ligne**
(#215), ainsi que les **mails d'activation et de rappel** (#237).

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
- **Un seul abonnement programmé** par organisation : index unique partiel
  `organization_subscriptions_one_scheduled_idx` pour `status = 'scheduled'`.
- **Origine** (`manual`, `stripe`) : colonne texte, validée côté application ;
  une nouvelle origine ne demande pas de migration.
- **Formule** : `business` ou `premium` (contrainte `CHECK`). `free` n'est jamais
  un abonnement : c'est l'absence d'abonnement en cours.

## Règle « abonné »

`SubscriptionService` est le seul point du code qui répond à « abonné ou non » :

- `current(organizationId)` : abonnement en cours (`active` ou `past_due`) ; pour
  un abonnement **manuel**, la date de fin doit aussi être à venir — un abonnement
  échu ne compte plus, même avant le passage du job qui l'expire. La date de fin
  d'un abonnement en ligne (fin de période facturée) n'est pas lue : Stripe reste
  juge pendant les relances d'impayé ;
- `blocking(organizationId)` : abonnement en cours **ou** premier paiement en
  validation (`pending`) — ce qui interdit une nouvelle souscription ;
- `isSubscribed(organizationId)` : la règle, évaluée **à la lecture** ;
- `subscribedAmong(organizationIds)` : la même règle pour plusieurs organisations, en une requête ;
- `refreshPlan(organizationId, trx)` : recalcule `organizations.subscription_plan`.

La règle elle-même est **une seule fonction**, `whereCurrentSubscription`
(`app/services/subscription_plan_service.ts`), appliquée aux requêtes Lucid comme
aux requêtes `db`. `SubscriptionPlanService` (lecture en masse, seule écriture de
`organizations.subscription_plan`) n'utilise aucun modèle Lucid : les jobs peuvent
l'injecter par leur constructeur (la queue charge les jobs au boot, cf. `CLAUDE.md`).

## Saisie manuelle par l'admin (#214)

Bloc « Abonnement » de la fiche admin d'une organisation fournisseur
(`/admin/organizations/:id`, organisations `supplier` et `both`) : historique de
toutes les périodes (formule, statut, période, origine, auteur), et pour
l'abonnement manuel ouvert : nouvelle date de fin et résiliation immédiate. Le
formulaire de saisie n'apparaît que lorsqu'aucun abonnement n'est ouvert. Droit
`organizations.manage` ; chaque action est tracée dans le journal d'audit
(`subscription.created`, `subscription.extended`, `subscription.cancelled`).

| Route                                                             | Nom                                        |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `POST /:locale/admin/organizations/:id/subscriptions`             | `admin.organizations.subscriptions.store`  |
| `PATCH /:locale/admin/organizations/:id/subscriptions/:sid`       | `admin.organizations.subscriptions.extend` |
| `POST /:locale/admin/organizations/:id/subscriptions/:sid/cancel` | `admin.organizations.subscriptions.cancel` |

- **Dates** (`shared/helpers/subscription_period.ts`, testé dans
  `tests/unit/subscription_period.spec.ts`) : l'admin saisit un premier et un dernier jour (`AAAA-MM-JJ`, heure de
  Paris, `SUBSCRIPTION_TIMEZONE`). `starts_at` est le début du premier jour,
  `ends_at` le début du jour qui suit le dernier (fin **exclusive**).
- **Création** (`ManualSubscriptionService#create`) : `active` si le premier jour
  est atteint, `scheduled` sinon. Refusée si un abonnement est déjà ouvert
  (`scheduled`, `pending`, `active` ou `past_due`), si le dernier jour précède le
  premier ou est passé, ou si l'organisation est uniquement acheteuse.
- **Prolongation** : change la date de fin d'un abonnement manuel `scheduled` ou
  `active`. **Résiliation** : `cancelled` immédiat, retour en `free`.
- Un abonnement **en ligne** ne se modifie pas depuis le back-office : il se gère
  dans Stripe.
- **Passage planifié** `SyncSubscriptionsJob` → `SubscriptionScheduleService#syncDue` (accès `db` seul) (planning `sync-subscriptions`, toutes
  les heures à la minute 5, lançable depuis l'admin de la queue) : expire les
  abonnements manuels échus, **puis** active les abonnements programmés arrivés à
  leur premier jour — un renouvellement programmé prend donc le relais de
  l'abonnement qui se termine. Si l'organisation a souscrit en ligne entre-temps,
  l'abonnement programmé reste en attente (log `warn`) et l'admin arbitre.
  Idempotent ; les abonnements en ligne ne sont jamais touchés.

## Mails d'abonnement (#237)

Abonnements **manuels** uniquement : un abonnement en ligne est renouvelé par
Stripe, qui envoie ses propres reçus. Destinataires : owner et admin de
l'organisation fournisseur, chacun dans sa langue (`users.locale`). Service
`SubscriptionMailService` (accès `db` seul, injecté dans `SyncSubscriptionsJob`), appelé par le job après l'activation
et l'expiration.

- **Activation** (`subscription-activated`) : formule, période (dernier jour
  inclus) et droits ouverts par la formule (lignes incluses de la grille
  tarifaire). Part après le commit quand l'admin saisit un abonnement qui
  commence aujourd'hui, sinon au passage du job qui l'active. Une seule fois par
  abonnement (`activation_notified_at`).
- **Rappels** (`subscription-expiring`) : 7 jours avant la fin pour tout
  abonnement, et 30 jours avant en plus pour un abonnement **annuel** (au moins
  12 mois entre début et fin, `ANNUAL_SUBSCRIPTION_MIN_MONTHS` ; saisi à la main,
  un abonnement n'a pas de périodicité de facturation). Le lien mène à la page
  tarifs pour renouveler. Règle pure `dueReminderDays` (`shared/helpers/subscription.ts`) :
  - parmi les délais atteints, seul le plus proche de la fin part : un job qui a
    manqué le rappel à 30 jours n'envoie que celui à 7 jours ;
  - un délai plus long que l'abonnement lui-même est ignoré ;
  - le dernier rappel est noté **pour une date de fin** (`reminded_ends_at`,
    `reminded_days`) : une prolongation fait repartir les rappels pour la
    nouvelle date et aucun ne part pour l'ancienne ; un abonnement résilié ou
    expiré n'en reçoit plus.
- **Une seule fois** : chaque envoi est réservé en base par une mise à jour
  conditionnelle avant la mise en queue (deux passages concurrents ne réservent
  pas le même mail), puis dédoublonné par la clé d'idempotence de `SendMailJob`
  (`subscription-activated:subscription=<id>:to=…`,
  `subscription-expiring:days=<n>:ends=<ms>:subscription=<id>:to=…`).

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

- `tests/functional/subscription_mails.spec.ts` : activation (une fois, responsables
  seulement, immédiate à la saisie admin, ni programmé ni en ligne), rappels
  mensuel et annuel, prolongation, résiliation, double passage.
- `tests/unit/subscription_reminders.spec.ts` : jours à l'heure de Paris,
  abonnement annuel, rappel dû.
- `tests/functional/manual_subscriptions.spec.ts` : saisie admin (active,
  programmée, refus d'un second abonnement, dates incohérentes, organisation
  acheteuse, 403 sans droit), prolongation, résiliation, abonnement en ligne non
  modifiable, historique de la fiche ; règle « abonné » (actif, impayé, programmé,
  expiré, résilié, échu), contraintes en base, passage planifié (expiration,
  activation, idempotence, renouvellement enchaîné).
- `tests/unit/subscription_status.spec.ts` : correspondance des statuts, types
  de notification, prestataire inerte.
- `tests/functional/subscriptions.spec.ts` : page tarifs, droits, création et
  réutilisation du client, page de souscription, portail, notifications
  (activation, changement de formule, impayé, résiliation, rejeu, signature
  invalide, échec puis renvoi, contrainte d'unicité, paiement en validation,
  doublon en ligne, remplacement d'un abonnement déjà résilié), purge. Prestataire factice :
  `tests/utils/fake_subscription_billing_gateway.ts`.
