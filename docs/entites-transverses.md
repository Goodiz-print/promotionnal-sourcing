# Entités transverses

> Dernière mise à jour : 2026-10-18

Cinq entités partagées par plusieurs domaines (RFQ, catalogue, administration).
Elles sont conçues pour évoluer sans migration destructive : les types évoluent
dans `shared/types/`, pas dans le schéma.

| Entité                 | Table                  | Modèle                     | Fabrique                    | Service               | Points d'extension                 |
| ---------------------- | ---------------------- | -------------------------- | --------------------------- | --------------------- | ---------------------------------- |
| Notification           | `notifications`        | `Notification`             | `NotificationFactory`       | `NotificationService` | `NOTIFICATION_TYPES`               |
| Conversation           | `conversations`        | `Conversation`             | `ConversationFactory`       | `ConversationService` | RFQ optionnelle, sujet libre       |
| Message                | `messages`             | `Message`                  | `MessageFactory`            | `ConversationService` | corps borné (`MESSAGE_MAX_LENGTH`) |
| Import                 | `import_jobs`          | `ImportJob`                | `ImportJobFactory`          | `ImportJobService`    | `IMPORT_KINDS`, `IMPORT_STATUSES`  |
| Décision de modération | `moderation_decisions` | `ModerationDecisionRecord` | `ModerationDecisionFactory` | `ModerationService`   | `MODERATION_TARGET_TYPES`          |

## Principes communs

- **Pas d'enum SQL** pour les types, statuts ou cibles : des chaînes validées par
  le code (listes `as const` dans `shared/types/`). Ajouter une valeur = une ligne
  de code, pas une migration.
- **`down()` systématique**, et migrations jamais modifiées une fois appliquées.
- **Accès par services**, jamais dans un contrôleur. Les services utilisent le
  modèle Lucid ; aucun job chargé au boot n'importe ces modèles.
- **Erreurs métier** dans `app/exceptions/<domaine>_errors.ts`.

## Notifications (#57)

- `type` + `data` (JSON). Le `data` porte le contexte d'affichage (ids, libellés).
- `readAt` : lue ou non. `markRead` est idempotent et ne déplace pas la date de lecture.
- Lecture stricte : une notification d'un autre utilisateur donne une erreur 404,
  comme une notification inexistante.
- **Non couvert** : l'envoi temps réel (Transmit). Il se branchera sur `notify`.

## Messagerie (#8)

- Un fil relie une organisation acheteuse et une organisation fournisseur. Il peut
  être rattaché à une RFQ ; si la RFQ disparaît, le fil reste (`rfq_id` passe à `NULL`).
- Seuls les **membres** des deux organisations peuvent lire ou écrire
  (`ConversationService.assertParticipant`).
- **Non couvert** : suivi de lecture par participant. Il fera l'objet d'une table dédiée.

## Imports (#49, #77)

- Cycle : `pending` → `running` → `completed` | `failed`. Toute autre transition
  lève `ImportJobStateException`.
- Les erreurs de ligne sont stockées en JSON, bornées à `IMPORT_MAX_STORED_ERRORS`
  (100). `errorCount` reste exact au-delà. L'échec global est consigné en ligne 0.
- Un import échoué ne se relance pas : on crée un nouveau job.
- **Limite** : `recordRow` écrit une fois par ligne. Au-delà de quelques milliers
  de lignes, il faudra regrouper les écritures.

## Modération (#54)

- Historique en **ajout seul** : une décision n'est jamais modifiée. Le statut
  courant est la dernière décision ; sans décision, la cible est `pending`.
- Table polymorphe (`target_type` / `target_id`) : pas de clé étrangère, donc une
  cible supprimée garde son historique.
- Ce service ne décide pas quoi modérer. Brancher une cible = consulter
  `currentStatus` avant d'afficher ou de publier.

## Pistes et questions ouvertes

- Suivi de lecture des messages (table dédiée, par participant).
- Modération des organisations et des produits : quelles règles de publication
  dépendent du statut ?
- Imports : quel format d'erreur voulu pour l'export côté fournisseur ?
