# Abonnement fournisseur saisi par l'admin, activation et expiration automatiques

> Date : 2026-11-20

Issue #214. L'équipe plateforme active à la main l'abonnement d'un fournisseur (Business ou Premium), avec un premier et un dernier jour. Le fournisseur repasse automatiquement en gratuit à la fin.

- **Fiche admin d'une organisation fournisseur** (`/admin/organizations/:id`) : nouveau bloc « Abonnement » avec l'historique de toutes les périodes (formule, statut, période, origine manuelle ou en ligne, auteur de la saisie). Sur l'abonnement manuel ouvert, l'admin peut changer la date de fin ou le résilier tout de suite. Le formulaire de saisie (formule, premier jour, dernier jour) n'apparaît que si aucun abonnement n'est ouvert.
- **Routes** (droit `organizations.manage`) :
  - `POST admin/organizations/:id/subscriptions` (`admin.organizations.subscriptions.store`) ;
  - `PATCH admin/organizations/:id/subscriptions/:subscriptionId` (`admin.organizations.subscriptions.extend`) ;
  - `POST admin/organizations/:id/subscriptions/:subscriptionId/cancel` (`admin.organizations.subscriptions.cancel`).

  Chaque action est tracée dans le journal d'audit : `subscription.created`, `subscription.extended`, `subscription.cancelled`.

- **Dates** : jours à l'heure de Paris, dernier jour inclus. Un premier jour futur crée un abonnement `scheduled`.
- **Refus** : un second abonnement tant qu'un autre est ouvert ; un dernier jour avant le premier ou déjà passé ; une organisation uniquement acheteuse ; la modification d'un abonnement en ligne (il se gère dans Stripe).
- **Job planifié** `SyncSubscriptionsJob` (`sync-subscriptions`, toutes les heures) : il expire les abonnements manuels échus puis active les abonnements programmés. Il recalcule ensuite `organizations.subscription_plan` et ne touche jamais aux abonnements en ligne.
- **Règle « abonné »** (`SubscriptionService#isSubscribed` / `subscribedAmong`, définie une fois dans `whereCurrentSubscription`) : un abonnement manuel dont la date de fin est passée ne compte plus, même avant le passage du job.
- **Utilitaires** testés unitairement : `shared/helpers/subscription_period.ts` (jours heure de Paris, validité d'une période) et `shared/helpers/collections.ts` (`partition`).
- **Base** : migration `1794000000030` ajoutant l'index unique partiel `organization_subscriptions_one_scheduled_idx`, soit un seul abonnement programmé par organisation.
- **Tests** : `tests/functional/manual_subscriptions.spec.ts`, `tests/unit/subscription_period.spec.ts`.
- **Documentation** : `docs/abonnements.md`, section « Saisie manuelle par l'admin ».
