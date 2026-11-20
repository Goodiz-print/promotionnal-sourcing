# Mails d'activation et de rappel avant la fin d'un abonnement

> Date : 2026-11-20

Issue #237, à la suite de #214. Le fournisseur est prévenu quand son abonnement manuel devient actif, puis avant sa fin pour le renouveler.

- **Mail d'activation** (`subscription-activated`) : formule, période (dernier jour inclus) et droits ouverts par la formule. Il part dès la saisie admin d'un abonnement qui commence aujourd'hui, sinon quand le job active l'abonnement programmé. Une seule fois par abonnement.
- **Rappels** (`subscription-expiring`) : 7 jours avant la fin pour tout abonnement, et 30 jours avant en plus pour un abonnement annuel (au moins 12 mois entre début et fin). Le lien mène à la page tarifs pour renouveler.
- **Une seule fois** : une prolongation fait repartir les rappels pour la nouvelle date et aucun ne part pour l'ancienne ; un abonnement résilié n'en reçoit plus. Un job qui aurait manqué le rappel à 30 jours n'envoie que celui à 7 jours.
- **Destinataires** : owner et admin de l'organisation fournisseur, chacun dans sa langue. Abonnements manuels uniquement : Stripe gère les abonnements en ligne.
- **Job** : `SyncSubscriptionsJob` (horaire) envoie ces mails après l'activation et l'expiration.
- **Base** : migration `1794000000031` qui ajoute `organization_subscriptions.activation_notified_at`, `reminded_ends_at` et `reminded_days`.
- **Traductions** : clés `emails.subscriptionActivated.*` et `emails.subscriptionExpiring.*` dans les 9 langues.
- **Tests** : `tests/functional/subscription_mails.spec.ts`, `tests/unit/subscription_reminders.spec.ts`, `tests/unit/mail_templates.spec.ts`.
- **Documentation** : `docs/abonnements.md` (section « Mails d'abonnement ») et `docs/mail.md`.
