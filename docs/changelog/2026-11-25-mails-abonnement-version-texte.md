# Mails d'abonnement : version texte

> Date : 2026-11-25

Les mails d'activation (`subscription_activated`) et de fin prochaine (`subscription_expiring`) d'un abonnement manuel (#237) n'avaient qu'une version HTML (#292). Ils portent désormais aussi une version texte, rendue dans la langue du destinataire comme les mails de demande de devis (#219) : `LocalizedMail#textViewIn`, même état de vue que le HTML.

- Gabarits : `resources/views/emails/subscription_activated_text.edge` (formule, période ou date de début, droits ouverts, lien vers l'abonnement) et `resources/views/emails/subscription_expiring_text.edge` (délai, date de fin, conséquence sans renouvellement, lien de renouvellement).
- Aucune nouvelle clé de traduction : les gabarits texte reprennent les clés `emails.subscriptionActivated.*` / `emails.subscriptionExpiring.*` déjà présentes dans les 9 langues.
- Tests : groupe « Mails — abonnement, version texte (#292) » dans `tests/unit/mail_templates.spec.ts` (contenu, dates, lien, absence de HTML, rendu dans chaque langue).
