# Supervision des emails en échec et du stockage Cellar (administration)

> Date : 2026-11-06

Issue #178 : les envois en échec (`mail_deliveries`) et le registre des fichiers (`storage_objects`) ne se lisaient que par SQL, et ne se rejouaient que par `node ace mail:retry` ou par le planning de reprise.

## Droit et navigation

Nouveau droit `ops.manage`, porté par le seul rôle `admin` (les adresses des destinataires et les erreurs SMTP sont des données personnelles). 403 pour les autres rôles plateforme ; onglets « Emails » et « Stockage » masqués.

## Emails

- `GET /:locale/admin/mail` (`admin.mail.index`, `MailController`, props `overview`, `deliveries`, `filters`, `statuses`, `kinds`) : taux d'échec par type de mail sur 30 jours (envoyés, en échec, en cours, taux = échecs / envois terminés) et liste paginée filtrable par état et par type.
- `GET /:locale/admin/mail/:id` (`admin.mail.show`) : erreur complète (4 000 caractères), clé d'idempotence, dates. **La charge n'est jamais exposée** : elle contient des URL signées (réinitialisation de mot de passe, vérification d'adresse).
- `POST /:locale/admin/mail/:id/retry` (`admin.mail.retry`) : rejoue un mail. Audit `mail.retried` (type du mail, sans l'adresse du destinataire).
- `POST /:locale/admin/mail/retry` (`admin.mail.retryAll`) : rejoue la dead-letter, d'un type (`kind`) ou de tous, 200 mails au plus (les plus anciens d'abord). Audit `mail.bulk_retried` (type, nombre rejoué, nombre ignoré). Sans rien à rejouer, ni audit ni envoi.

### États affichés

`mail_deliveries` ne connaît que `sent` et `failed`. Une ligne `failed` modifiée depuis moins de 30 minutes est affichée **« en cours »** (premier essai, nouvel essai de la queue ou rejeu demandé) ; au-delà, elle est **« en échec »** : la dead-letter, la seule rejouable.

### Rejeu

Le rejeu réutilise `SendMailJob` avec le `SendMailPayload` conservé : même clé d'idempotence, donc un mail déjà `sent` n'est jamais renvoyé. Les lignes rejouables sont verrouillées (`FOR UPDATE SKIP LOCKED`), passées « en cours » et auditées dans une même transaction, puis les jobs sont mis en queue après le commit : deux admins, ou un clic répété, ne remettent pas le même mail deux fois. Si la mise en queue échoue après le commit, la ligne revient dans la dead-letter à l'issue des 30 minutes. Une ligne sans charge (purgée) ne peut pas être rejouée : elle n'entre pas dans la limite du lot, n'est pas comptée dans « à rejouer » et apparaît comme ignorée dans le rejeu groupé. Une mise en queue qui échoue rend sa ligne à la dead-letter aussitôt et est signalée à l'admin (l'audit enregistre le lot demandé).

## Stockage

- `GET /:locale/admin/storage` (`admin.storage.index`, `StorageController`, prop `overview`) : objets et octets par état, arriéré (`pending_upload` / `pending_delete` de plus de 24 h, les 50 plus anciens listés), volume prêt par organisation (20 premières) et volume sans organisation connue.
- `POST /:locale/admin/storage/recover` (`admin.storage.recover`) : met en queue `RecoverStorageUploadsJob`, le job du planning `recover-storage-uploads`. Audit `storage.recovery_requested` (taille de l'arriéré). Aucun fichier n'est supprimé d'ici directement.

### Volume par organisation

Un fichier est rattaché à l'organisation propriétaire de chaque colonne qui le référence (logo, bannière, actualités, documents, images et variantes, documents produit). Un fichier partagé entre deux organisations (dédoublonnage par checksum) compte pour chacune : la somme par organisation peut dépasser le total. Le calcul tient en une seule requête (le rattachement est matérialisé une fois). Le type de la table de rattachement est dérivé de `STORAGE_REFERENCES` : ajouter une colonne référençante sans dire à qui elle appartient est une erreur de compilation.

## Points d'attention

- Migration à appliquer : `node ace migration:run` (`1794000000008`, index `updated_at` et `created_at, kind` sur `mail_deliveries`).
- Les 7 langues autres que le français et l'anglais reçoivent le texte anglais pour les clés admin.
- Tests : `tests/functional/admin_ops.spec.ts` (non exécuté en local, pas de pgvector ≥ 0.7 dans le conteneur : à vérifier en CI), `tests/inertia/admin_ops.spec.ts`, droits et traductions en tests unitaires.
