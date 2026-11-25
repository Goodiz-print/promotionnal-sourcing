# Coordonnées de l'agence pour les fournisseurs abonnés

> Date : 2026-11-20

Issue #221. Un fournisseur abonné (Business ou Premium) reçoit les coordonnées
de l'agence qui le consulte, pour la contacter en direct. Un fournisseur non
abonné n'en reçoit aucune : l'anonymat de #220 reste intact.

- **Bloc de coordonnées** (`BuyerContactType`, `shared/types/rfq.ts`) : nom de
  l'agence, auteur de la demande, email, téléphone et adresse. L'email est celui
  de l'agence (`organizations.email`) et, à défaut, celui de l'auteur de la
  demande. Il est construit par `buyerContactOf`
  (`shared/helpers/buyer_contact.ts`), partagé par l'écran et les mails.
- **Règle** : celle de `SubscriptionService#isSubscribed`, vérifiée côté serveur.
- **Écran** « Demandes reçues » : nouvelle prop `rfq.buyerContact` sur
  `supplier/rfqs/show` (et sur le formulaire de devis), `null` pour un non
  abonné. Le bloc `SupplierBuyerContact` (email et téléphone cliquables) apparaît
  aussi sur les demandes reçues **avant** l'abonnement.
- **Mails** de demande et de relance : champ `buyerContact` dans la charge du
  job, rendu en HTML et en texte (partiels `emails/partials/buyer_contact*`). Les
  mails déjà envoyés ne sont pas renvoyés. Un job mis en queue avant ce
  changement se rend sans le bloc.
- **Auteur de la demande** : la colonne `rfqs.created_by_user_id` existait déjà
  et `RfqService#create` la renseignait, y compris pour les demandes du panier
  (`QuoteCartService#checkout`). Aucune migration.
- **Collecte** :
  - Inscription agence (`POST /:locale/signup/agency`) : nouveau champ
    facultatif `contactEmail`, enregistré dans `organizations.email` ; le
    téléphone était déjà demandé.
  - Paramètres de l'organisation : l'email se modifiait déjà. Pour une agence, un
    texte d'aide précise qu'il est transmis aux fournisseurs abonnés.
  - Paramètres : vider l'email, le téléphone ou un champ d'adresse efface
    désormais la valeur. Avant, un champ vide n'était pas envoyé et l'ancienne
    valeur restait.
- **Requêtes** : l'auteur de la demande n'est relu que si un destinataire est
  abonné.
- **Données personnelles** : sans email de contact, c'est l'email de l'auteur
  qui est transmis. Les coordonnées figurent aussi dans la charge des jobs de
  mail (`queue_jobs`) le temps de l'envoi.
- **Traductions** dans les 9 langues : `emails.buyerContact.*`,
  `rfq.supplier.show.contact.*`, `agency_signup.fields.contactEmail`,
  `agency_signup.contactEmailHelp`, `organization.fields.emailBuyerHint`.
- **Reste à faire** : l'information des agences dans les mentions légales
  (#233).
- **Tests** :
  - `rfq_buyer_contact.spec.ts` : écran abonné et non abonné, repli de l'email,
    abonnement après coup, demande sans auteur, mails d'une demande saisie au
    formulaire et d'une demande du panier, relance ;
  - `agency_signup.spec.ts` : email de contact enregistré, absent, invalide ;
  - `organization_settings.spec.ts` (Japa) : un champ vidé efface la valeur ;
  - `mail_templates.spec.ts` : bloc en HTML et en texte, lignes omises, jamais
    dans un mail anonyme ;
  - Vitest : `supplier_rfqs.spec.ts`, `signup_agency.spec.ts`,
    `organization_settings.spec.ts`.
