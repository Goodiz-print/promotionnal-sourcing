# Mails traduits selon la langue du destinataire (#58)

> Date : 2026-10-24

Tous les mails transactionnels sont désormais rédigés dans la langue de la personne
qui les reçoit, dans les **9 langues** de l'interface.

- **Charge du job** : `SendMailPayload` porte `locale` (au même niveau que `to`),
  résolue par l'appelant à la mise en queue. Une charge antérieure, sans `locale`,
  retombe sur le français ; la dead-letter conserve la langue, `mail:retry` rejoue
  donc dans la même.
- **Langue retenue** : demande de devis → `users.locale` de chaque membre habilité
  (un même envoi peut partir en plusieurs langues, lien préfixé par la locale du
  destinataire) ; adresse de contact d'organisation → langue du premier membre
  habilité, à défaut le français ; invitation → langue de l'inviteur ;
  réinitialisation de mot de passe et vérification d'adresse → langue de la page
  d'origine ; bienvenue → `users.locale`.
- **Textes** : `resources/lang/{fr,en,de,es,it,nl,pt,pl,sv}/emails.json`, au format
  ICU (pluriels corrects, y compris `few`/`many` en polonais). Les clés `emails.*` ne
  sont pas envoyées au navigateur.
- **Gabarits** : nouveau gabarit commun `resources/views/emails/layout.edge`
  (en-tête, titre, pied de page), utilisé par les cinq mails. Nouvelle classe de base
  `LocalizedMail` (`app/mails/localized_mail.ts`).
- **Inchangé** : l'alerte interne `MailDeliveryFailedAlert` reste en français
  (destinataire : l'équipe technique).
- Tests : `tests/unit/mail_templates.spec.ts` (rendu dans les 9 langues, symétrie des
  fichiers), `tests/functional/rfq_mail_locale.spec.ts`, `tests/unit/send_mail_job.spec.ts`.
