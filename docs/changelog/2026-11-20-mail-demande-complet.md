# Mail de demande de devis complet

> Date : 2026-11-20

Issue #219. Le fournisseur peut chiffrer une demande depuis le mail, sans se
connecter.

- **Contenu** : le mail `rfq-received` et la relance `rfq-reminder` reprennent la
  description et chaque ligne de la demande : produit, référence (variante, à
  défaut produit), variante, quantité, marquage (position, technique, nombre de
  couleurs), note de l'agence.
- **Prix indicatifs** par ligne : unitaire, marquage par pièce, frais techniques
  et total, lus dans `rfq_items.specs` (posés par le panier). Ce sont les mêmes
  valeurs que dans le panier de l'agence et sur l'écran « Demandes reçues ». Ils
  sont présentés comme indicatifs. Une ligne sans prix catalogue affiche « Pas de
  prix catalogue : à chiffrer ».
- **Mise en page** : l'invitation à répondre au mail (avec le devis en PDF) passe
  avant le lien vers la plateforme, devenu secondaire. Un mail qui porte une
  adresse relais n'affiche plus « merci de ne pas y répondre ».
- **Version texte** des deux mails (`*_text.edge`), lisible par les logiciels de
  devis ; exclue de Prettier.
- **Charge du job** : `RfqReceivedMailData` et `RfqReminderMailData` gagnent
  `description` et `lines` (`RfqMailLine`, `shared/types/mail.ts`), facultatifs
  pour les jobs mis en queue avant le déploiement. Les classes de mail prennent
  désormais la charge entière.
- Traductions `emails.rfqDetails.*` dans les 9 langues.
- Tests : `mail_templates.spec.ts` (plusieurs lignes, avec et sans marquage, avec
  et sans prix, texte, relance, ancien job), `rfq_mail_line.spec.ts`,
  `quote_cart.spec.ts` (le mail reprend le prix du panier) et `send_mail_job.spec.ts`.
