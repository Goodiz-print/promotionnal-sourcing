# Mails transactionnels envoyés par la queue plutôt que par la file mémoire (#33)

> Date : 2026-08-20

`mail.sendLater()` déléguait à la file **interne à `@adonisjs/mail`** : une file
en mémoire, dans le process HTTP. Un redémarrage (déploiement, crash,
scale-down) perdait les mails en attente ; un SMTP indisponible les perdait
aussi, sans retry ni trace. Seule l'invitation de membre était exposée, mais le
sujet grossit avec les RFQ et les devis, où la livraison du mail est le
déclencheur métier.

- **`SendMailJob`** (`app/jobs/send_mail_job.ts`) — job générique d'envoi. Il
  reconstruit la classe de mail depuis une charge sérialisée puis appelle
  `mail.send()` : l'envoi est **synchrone côté worker**, la file c'est la queue
  (table `queue_jobs`). **5 tentatives**, backoff exponentiel 30 s → 15 min ;
  `failed()` loggue `{ err, to, kind }` et l'enregistrement est conservé
  **30 jours** (`removeOnFail`) pour inspection ou rejeu.
- **Charge sérialisable** (`shared/types/mail.ts`) — union discriminée par
  `kind` (`MAIL_KINDS`), avec `to` hissé hors de `data` pour pouvoir loguer le
  destinataire sans connaître le type de mail. Ni mailer ni modèle Lucid dans la
  charge : uniquement des données déjà résolues (nom d'organisation, rôle, URL
  signée…). Le `switch` de `buildMail()` est exhaustif — ajouter un `kind` sans
  le traiter est une erreur de compilation ; une charge corrompue lève
  `UnknownMailKindException` (`app/exceptions/mail_errors.ts`) plutôt que
  d'avaler le mail en silence.
- **`OrganizationInvitationsController#sendInvitationMail`** dispatche désormais
  le job (`store` et `resend`) — plus aucun `mail.sendLater()` dans le code.
- **Worker** : `node ace queue:work` devient une **dépendance de production**.
  Worker arrêté = aucun mail envoyé ; les jobs s'accumulent en `pending` et
  repartent au redémarrage — c'est précisément la garantie recherchée, mais elle
  suppose de superviser le process. Requêtes de diagnostic dans `docs/queue.md`.
- **Tests** — `QUEUE_DRIVER=sync` ajouté à `.env.test` (aligné sur la CI) : les
  jobs s'exécutent dans le process de test, les assertions passent donc de
  `assertQueued` à `assertSent` dans
  `tests/functional/organization_invitations.spec.ts` (15 tests). Nouveau
  `tests/unit/send_mail_job.spec.ts` (+5) : reconstruction du mail depuis la
  charge, panne SMTP propagée (c'est ce qui déclenche le rejeu), `kind` inconnu,
  politique de retry, `failed()` non relançant.
- **Connu, non traité** : pas d'idempotence — un échec survenu _après_ la remise
  SMTP fait renvoyer le mail au rejeu. Bénin pour une invitation, à traiter avant
  de brancher devis et commandes. Pas de dead-letter dédiée non plus : le log +
  la rétention 30 jours dans `queue_jobs` tiennent lieu de piste d'audit.
- **Doc** : `docs/mail.md` (§ envoi par la queue, ajout d'un type de mail,
  tests), `docs/queue.md` (jobs dispatchés à la demande, supervision du worker,
  pièges du driver `sync`), `docs/organisations.md` § Roadmap.
