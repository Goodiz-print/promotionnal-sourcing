# Souscription en ligne des abonnements fournisseurs (Stripe Billing)

> Date : 2026-11-19

Les fournisseurs souscrivent, changent de formule et résilient leur abonnement
(Business 250 € / mois, Premium 500 € / mois) sans intervention de l'équipe
(issue #215). Détail : `docs/abonnements.md`.

- **Donnée** : nouvelle table `organization_subscriptions` (formule, statut
  `scheduled | pending | active | past_due | expired | cancelled`, origine
  `manual | stripe`, dates, `stripe_subscription_id` unique, auteur), avec un
  index unique partiel qui interdit deux abonnements en cours pour une même
  organisation. `organizations.subscription_plan` devient la formule courante,
  écrite uniquement par `SubscriptionService` (socle commun avec #214).
- **Page tarifs** `GET /:locale/supplier/subscription` (`supplier.subscription.show`) :
  formule courante, statut, échéance, grille des formules ; entrée de menu
  « Abonnement » pour les owner/admin d'une organisation fournisseuse
  (ability `canManageSubscription`).
- **Souscription** `POST /:locale/supplier/subscription/checkout` : création du
  client Stripe à la première souscription (`billing_profiles.stripe_customer_id`),
  puis Stripe Checkout en mode abonnement. Refusée si un abonnement est déjà en
  cours ou si un premier paiement est encore en validation.
- **Portail de facturation** `POST /:locale/supplier/subscription/portal` :
  changement de formule, résiliation, moyen de paiement, factures.
- **Notifications** sur `POST /webhooks/stripe` (partagée avec les recharges
  publicitaires) : `customer.subscription.*` et `invoice.*`. Traitement
  idempotent (table `stripe_webhook_events`, même transaction), abonnement relu
  chez Stripe avant la transaction. Impayé : formule conservée pendant les
  relances (`past_due`), retirée quand Stripe abandonne. Un abonnement en ligne
  clôt un abonnement manuel en cours ; un **second abonnement en ligne** payé en
  parallèle est résilié chez Stripe pour qu'un seul soit facturé, et les
  administrateurs de la plateforme reçoivent une notification in-app
  (`subscription.duplicate_cancelled`) pour rembourser son paiement depuis le
  tableau de bord Stripe.
- **Rétention** : job `PurgeStripeWebhookEventsJob` (planning
  `purge-stripe-webhook-events`, chaque nuit) qui supprime les notifications
  traitées de plus de 30 jours.
- **Configuration** : nouvelles variables optionnelles `STRIPE_PRICE_BUSINESS`,
  `STRIPE_PRICE_PREMIUM` ; sans elles, la souscription en ligne est désactivée.
- **Traductions** : fichier `subscription.json` dans les 9 langues.
- **Tests** : `tests/unit/subscription_status.spec.ts`,
  `tests/functional/subscriptions.spec.ts`.
