# Anonymisation de l'agence pour les fournisseurs non abonnés

> Date : 2026-11-20

Issues #220 et #222. Sans abonnement, une demande de devis est anonyme : le
fournisseur ne sait pas quelle agence le consulte. Un encart l'invite à
s'abonner.

- **Règle** : celle de `SubscriptionService#isSubscribed` (abonnement payant en
  cours). Elle est vérifiée côté serveur, et le nom ni le logo de l'agence ne
  sont jamais envoyés au navigateur d'un non abonné.
- **Écrans « Demandes reçues »** (liste, détail) et formulaire de devis :
  - `SupplierRfqType.buyerName` (et `buyerLogoUrl`) vaut `null` pour un non
    abonné, et l'écran affiche « Agence anonyme ».
  - La règle est vérifiée à chaque affichage : s'abonner révèle l'agence sur les
    demandes déjà reçues, et l'expiration la masque de nouveau.
  - `SupplierRfqTransformer` reçoit `revealBuyer`, qui vaut faux par défaut.
- **Encart d'abonnement** (`inertia/components/subscription/subscription_upsell.vue`) :
  - Il s'affiche à la place du bloc agence, via la nouvelle prop `upsell`
    (`SubscriptionUpsellType`, `null` pour un abonné) des pages
    `supplier/rfqs/index` et `supplier/rfqs/show`.
  - Il mène à la page d'abonnement pour un propriétaire ou un administrateur ;
    il invite les autres membres à passer par eux.
- **Mails de demande et de relance** :
  - L'objet, le titre et l'introduction ne nomment pas l'agence. L'objet
    anonyme reprend le titre de la demande, pour que la messagerie ne regroupe
    pas plusieurs demandes dans un même fil.
  - Un encart « abonnez-vous » mène à la page d'abonnement (HTML et texte).
  - Dans la charge du job, `buyerName` devient `string | null` et
    `subscribePath` est ajouté. Les jobs déjà en queue se rendent comme avant.
  - Transition : une demande envoyée avant la mise en production a reçu un mail
    au nom de l'agence, mais sa relance, envoyée après, sera anonyme si le
    fournisseur n'est pas abonné.
- **Page d'abonnement** : un membre d'une organisation fournisseuse qui n'a pas
  le droit de souscrire (lien d'un mail anonyme) est ramené au tableau de bord
  avec un message (`subscription.flash.adminOnly`) au lieu d'un 403. Une
  organisation acheteuse reste refusée. L'encart du mail précise que la
  souscription est réservée aux propriétaires et administrateurs.
- **Notifications in-app** `rfq.received` et `quote.rejected` : pour un non
  abonné, `buyerName` est absent des données. La cloche et le mail de rappel
  prennent alors le libellé `notifications.anonymous.*` (helper partagé
  `notificationMessageKey`). `quote.accepted` et les commandes nomment l'agence,
  puisqu'elle passe commande.
- **Limite acceptée** : le titre, la description ou une signature de l'agence
  peuvent la nommer. Il n'y a pas de filtrage (décision client du 16/11/2026).
- **Traductions** dans les 9 langues :
  - `emails.rfqReceived.anonymous.*`, `emails.rfqReminder.anonymous.body`,
    `emails.subscriptionUpsell.*` ;
  - `subscription.flash.adminOnly` ;
  - `notifications.anonymous.*` ;
  - `rfq.supplier.anonymousBuyer` et `subscription.upsell.*`.
- **Tests** :
  - `rfq_buyer_anonymity.spec.ts` : écrans, révélation puis masquage, mail,
    relance, notifications `rfq.received` et `quote.rejected` ;
  - `subscriptions.spec.ts` : redirection d'un membre sans droit de souscrire ;
  - `mail_templates.spec.ts` : rendu anonyme dans les 9 langues ;
  - `notification_message_key.spec.ts` et `supplier_rfqs.spec.ts` (Vitest).
