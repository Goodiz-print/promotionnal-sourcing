# Entités transverses : notifications, messagerie, imports, modération

Date : 2026-10-18

- **Notifications** (`notifications`, #57) : persistance et lecture (`notify`, `unreadCount`, `markRead`, `markAllRead`, `listFor`). Types déclarés dans `NOTIFICATION_TYPES`.
- **Messagerie** (`conversations`, `messages`, #8) : fils acheteur ↔ fournisseur, rattachables à une RFQ. Écriture réservée aux membres des deux organisations.
- **Imports** (`import_jobs`, #49, #77) : cycle `pending` → `running` → `completed` | `failed`, erreurs de ligne bornées à 100.
- **Modération** (`moderation_decisions`, #54) : historique en ajout seul, statut courant = dernière décision, `pending` par défaut. Cible polymorphe.
- **Fabriques** pour les cinq entités.
- **Tests** : `tests/functional/transversal_*.spec.ts` (23 tests).
- **Doc** : `docs/entites-transverses.md`.
- **Non couvert** : envoi temps réel des notifications, suivi de lecture des messages, application de la modération aux organisations et aux produits.
