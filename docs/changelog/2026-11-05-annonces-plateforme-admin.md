# Annonces plateforme (administration)

> Date : 2026-11-05

Issue #169 : l'équipe admin émet une annonce vers un segment d'utilisateurs, en notification in-app et/ou par mail, et suit ce qui est parti et lu.

## Écrans et routes (droit `announcements.manage`, admin seul)

Un envoi touche des utilisateurs de toutes les organisations : nouveau droit `announcements.manage`, porté par le seul rôle `admin`. Les autres rôles plateforme ne voient ni l'onglet ni les routes (403).

- `GET /:locale/admin/announcements` (`admin.announcements.index`, `AnnouncementController`) : historique paginé (25), plus récent d'abord : titre, segment, canaux, statut, destinataires, **taux de lecture in-app** (notifications lues / destinataires), auteur, date.
- `GET /:locale/admin/announcements/new` (`admin.announcements.create`) : formulaire. Chaque segment affiche le nombre d'utilisateurs actifs qu'il cible.
- `POST /:locale/admin/announcements` (`admin.announcements.store`) : crée l'annonce et met l'envoi en queue. L'envoi doit être **confirmé** (case à cocher).
- Onglet « Annonces » dans la navigation admin.

## Segments

| Segment        | Destinataires                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `all`          | tous les utilisateurs non suspendus (même sans organisation)                                   |
| `buyers`       | membres d'une organisation non archivée de type `buyer` ou `both` (les agences en font partie) |
| `suppliers`    | membres d'une organisation non archivée de type `supplier` ou `both`                           |
| `agencies`     | membres d'une organisation non archivée qui a un profil agence (`agency_profiles`)             |
| `organization` | membres de l'organisation dont l'identifiant est saisi (inconnue : 404, ni annonce ni audit)   |

Un utilisateur membre de plusieurs organisations du segment reçoit **une seule** annonce. Les comptes suspendus sont exclus.

## Canaux et langues

- **In-app** : une `notifications` de type `announcement` par destinataire, avec `announcement_id` (lien vers l'annonce, utilisé pour le taux de lecture). Texte affiché : `{titre} — {texte}`.
- **Mail** : `SendMailJob` (`kind: announcement`, classe `AnnouncementNotification`), uniquement vers les adresses **vérifiées**, avec la clé d'idempotence `announcement:<id>:<adresse>` (un rejeu ne renvoie pas le mail).
- **Contenu par langue** : `announcements.translations` (`{ fr: { title, body }, en: … }`). Le français est obligatoire, l'anglais facultatif (titre et texte vont ensemble). Chaque destinataire reçoit sa langue (`users.locale`), à défaut l'anglais, à défaut le français. Le back-office ne saisit que fr et en ; les autres langues passent par le repli.

## Envoi asynchrone

`SendAnnouncementJob` (queue `default`, 3 reprises avec backoff exponentiel) appelle `AnnouncementDispatcher`, qui parcourt le segment par lots de 500 (curseur sur `users.id`). La distribution est **rejouable** : contrainte unique `(announcement_id, user_id)` sur `notifications` (insertion `ON CONFLICT DO NOTHING`) et idempotence des mails. Statuts : `queued` → `sending` → `sent`, ou `failed` (motif conservé dans `announcements.error`) après épuisement des reprises.

La création de l'annonce et son entrée d'audit `announcement.created` (cible `announcement`, segment, canaux, langues) partagent la même transaction ; la mise en queue a lieu après validation.

## Base de données

Migration `1794000000004_create_announcements_table.ts` : table `announcements` (segment, organisation ciblée, canaux, `translations` jsonb, statut, `recipients_count`, `error`, `sent_at`) et colonne `notifications.announcement_id` (FK `SET NULL`) avec contrainte unique `(announcement_id, user_id)`. `database/schema.ts` a été complété à la main pour la nouvelle colonne.

## Non couvert

- **Taux de lecture des mails** : seul le canal in-app est mesuré (pas de pixel de suivi, par choix de confidentialité).
- **Temps réel** : l'annonce apparaît dans la cloche au prochain chargement (pas de poussée Transmit depuis le job).
- **Désabonnement / préférences de notification** : n'existent pas dans l'application ; une annonce part vers tous les membres du segment.
- **Planification, brouillons, modification ou annulation d'une annonce** : l'envoi est immédiat.
- **Sélecteur d'organisation** : l'organisation ciblée se saisit par son identifiant.
- Annonce vers les 7 autres langues : repli sur l'anglais.

Tests : `tests/functional/admin_announcements.spec.ts`, `tests/inertia/admin_announcements.spec.ts`, `tests/unit/announcement_content.spec.ts`, `tests/unit/mail_templates.spec.ts`, `tests/unit/platform_permissions.spec.ts`.
