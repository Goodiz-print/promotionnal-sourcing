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
| `stripe_webhook_events`               | Identifiants des notifications Stripe d'abonnement déjà traitées (idempotence).                      |

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
   abonnement est déjà en cours (le changement de formule passe par le portail).
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
- L'identifiant de l'événement est inséré dans `stripe_webhook_events` **dans la
  même transaction** que la mise à jour : une notification rejouée est ignorée ;
  un traitement en échec annule l'insertion et Stripe renvoie la notification.
- L'abonnement est **relu** chez Stripe (`subscriptions.retrieve`) plutôt que
  déduit du contenu de la notification : l'ordre d'arrivée n'importe pas.
- La ligne locale est retrouvée par `stripe_subscription_id` (unique) : mise à
  jour, jamais dupliquée. L'organisation vient de la métadonnée
  `organizationId` de l'abonnement, à défaut du profil de facturation qui porte
  le client.
- Un abonnement en ligne qui devient courant clôt (`cancelled`) un éventuel
  abonnement manuel encore en cours : un seul à la fois.

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

- `tests/unit/subscription_status.spec.ts` : correspondance des statuts.
- `tests/functional/subscriptions.spec.ts` : page tarifs, droits, création et
  réutilisation du client, page de souscription, portail, notifications
  (activation, changement de formule, impayé, résiliation, rejeu, signature
  invalide, échec puis renvoi, contrainte d'unicité). Prestataire factice :
  `tests/utils/fake_subscription_billing_gateway.ts`.
