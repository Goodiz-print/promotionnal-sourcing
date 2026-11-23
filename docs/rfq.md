# Demandes de devis (RFQ)

**Phase 3** (#4) : permettre à une organisation acheteuse de décrire un besoin,
de le détailler ligne par ligne, de le soumettre simultanément à plusieurs
organisations fournisseuses — et à celles-ci de le recevoir, de le consulter et
de le décliner.

Décision d'organisation reprise de la Phase 2 (#3) : **un fournisseur = une
organisation** de type `supplier`/`both`, multi-utilisateurs. Les deux côtés
d'une RFQ pointent donc vers `organizations` — `rfqs.buyer_organization_id` et
`rfq_suppliers.supplier_organization_id` — et non vers la fiche catalogue
`suppliers`, qui n'a pas d'utilisateur pour répondre.

> Ce document couvre les trois PR de la Phase 3 : **fondation backend**,
> **écrans acheteur** et **écrans fournisseur + notification par mail**.

## Tables

- **`rfqs`** — la demande : `buyer_organization_id` (FK `organizations`,
  `CASCADE`), `title`, `description`, `status` enum(`draft`, `published`,
  `closed`) défaut `draft`, `deadline`, `budget_max decimal(12,2)`,
  `created_by_user_id` (FK `users`, **`SET NULL`** — la demande appartient à
  l'organisation, pas à son auteur, qui peut la quitter), `published_at`,
  `closed_at`. Index `(buyer_organization_id, status)` pour l'écran « mes
  demandes ». Migration `…969_create_rfqs_table`.
  `batch_id uuid` nullable, indexé (#229, migration `…039_add_batch_id_to_rfqs`) :
  lot de panier commun aux demandes d'une même validation du panier
  (`QuoteCartService#checkout`), `null` pour une demande créée seule ; exposé en
  `batchId` côté agence uniquement (pas dans `SupplierRfqType`).
- **`rfq_items`** — une ligne du besoin : `rfq_id` (`CASCADE`), `name`
  (obligatoire), `description`, `quantity`, `unit`, `specs jsonb`, plus
  `category_id` et `product_id` **tous deux nullables et indépendants**
  (`SET NULL`) : l'acheteur peut viser un produit précis du catalogue, cadrer
  une catégorie, ou décrire un besoin libre. `SET NULL` plutôt que `CASCADE` —
  supprimer un produit du catalogue ne doit pas effacer une ligne d'une demande
  déjà envoyée, `name` restant porté par l'item.
  Migration `…970_create_rfq_items_table`.
- **`rfq_suppliers`** — table pivot **avec statut par destinataire** :
  `rfq_id` (`CASCADE`), `supplier_organization_id` (FK `organizations`,
  `CASCADE`), `status` enum(`pending`, `sent`, `viewed`, `responded`,
  `declined`) défaut `pending`, `sent_at`. Unicité `(rfq_id,
supplier_organization_id)` — un fournisseur n'est destinataire qu'une fois ;
  index `(supplier_organization_id, status)` pour l'écran « demandes reçues ».
  Migration `…971_create_rfq_suppliers_table`.

## Modèles & relations

- **`Rfq`** (`app/models/rfq.ts`) — `belongsTo(Organization) buyerOrganization`,
  `belongsTo(User) createdBy`, `hasMany(RfqItem) items`,
  `hasMany(RfqSupplier) suppliers` ; override `declare status: RfqStatus`.
- **`RfqItem`** — `belongsTo(Rfq)`, `belongsTo(Category)`, `belongsTo(Product)`.
  `specs` est la **seule colonne du projet redéclarée avec son décorateur**
  (`prepare`/`consume`) : `jsonb` revient en objet sous Postgres et en texte
  sous SQLite (connexion de repli), et le schéma généré la type `any` — la
  (dé)sérialisation explicite règle les deux.
- **`RfqSupplier`** — `belongsTo(Rfq)`,
  `belongsTo(Organization) supplierOrganization` ;
  override `declare status: RfqSupplierStatus`.

Types et constantes de statuts dans `shared/types/rfq.ts` (`RFQ_STATUSES`,
`RFQ_SUPPLIER_STATUSES`, `TERMINAL_RFQ_SUPPLIER_STATUSES`, `CreateRfqData`,
`UpdateRfqData`, `RfqItemData`) — les migrations en dérivent leurs `enum`, comme
`DELIVERY_SCOPES` pour les profils fournisseurs.

## Cycle de vie

Trois services se partagent le cycle (découpage #232) :

| Service               | Fichier                                 | Rôle                                                                                         |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `RfqService`          | `app/services/rfq_service.ts`           | rédaction, lecture (agence et fournisseur), destinataires, `publish`, `send`, `close`        |
| `RfqDeadlineService`  | `app/services/rfq_deadline_service.ts`  | échéance : `expire`, `expireDue` (job), `extendDeadline` (réouverture)                       |
| `RfqRecipientService` | `app/services/rfq_recipient_service.ts` | avancement de chaque destinataire (lu, répondu, décliné, expiré, réponse tardive) et relance |

Les règles pures liées à l'échéance — `acceptsResponses`, `isLateReply`,
`startOfDeadlineDay`, `parseRfqDeadline` — vivent dans
`shared/helpers/rfq_deadline.ts` : controllers et services les appellent sans
dépendre d'un service, et les trois services n'ont pas de dépendance circulaire
(`RfqDeadlineService` → `RfqRecipientService` ← `RfqService`).

```
draft ──publish──▶ published ──close──▶ closed
                       │  ▲
                       │  └──extendDeadline── expired
                       ├──expire (échéance dépassée)──▶ expired
                       └──send──▶ destinataires `pending` → `sent`
```

**`publish` et `send` sont deux transitions distinctes**, volontairement :
publier fige le besoin, envoyer notifie les destinataires. Un acheteur peut
ajouter un fournisseur à une demande déjà publiée puis relancer `send` — seuls
les `pending` basculent, personne n'est relancé deux fois. `send` renvoie
exactement les lignes basculées (relation `supplierOrganization` préchargée) :
c'est cette liste que `RfqNotificationService` utilise pour envoyer les mails,
sans risque de doublon.

Règles appliquées par ces services :

| Méthode                    | Autorisée si                                                 | Exception sinon                                            |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `update`, `replaceItems`   | `draft`                                                      | `RfqNotEditableException`                                  |
| `addSuppliers`             | statut ni `closed` ni `expired`                              | `RfqNotEditableException`                                  |
| `removeSupplier`           | destinataire encore `pending`                                | `RfqNotEditableException`                                  |
| `publish`                  | `draft` **et** au moins un item                              | `RfqNotPublishableException`                               |
| `send`                     | `published` **et** au moins un destinataire `pending`        | `RfqNotSendableException`                                  |
| `close`                    | `published`                                                  | `RfqNotClosableException`                                  |
| `expire`                   | `published`                                                  | `RfqNotExpirableException`                                 |
| `extendDeadline`           | `published` ou `expired`, nouvelle date valide               | `RfqNotExtendableException`, `RfqInvalidDeadlineException` |
| `markResponded`, `decline` | destinataire `sent`/`viewed`, demande non `expired`          | `RfqNotEditableException`                                  |
| `markRespondedByMail`      | destinataire `sent`/`viewed`/`expired`, demande non `closed` | — (renvoie `false`)                                        |

Autres invariants :

- **Un brouillon seul est modifiable.** Une demande partie chez un fournisseur
  ne se réécrit pas silencieusement : les devis reçus porteraient sur un besoin
  qui n'existe plus. **Une seule exception : l'échéance** (`RfqDeadlineService#extendDeadline`, voir
  ci-dessous) — elle ne change pas le besoin, seulement le temps laissé pour y répondre.
- **On ne retire pas un destinataire déjà notifié** — cela effacerait la trace
  de l'envoi. L'acheteur clôture la demande à la place.
- **Destinataires éligibles** : organisations `supplier`/`both` **non
  archivées** uniquement (`NotASupplierOrganizationException`) ; une
  organisation acheteuse n'a aucun écran pour répondre, une organisation
  archivée n'a plus personne pour lire.
- **`markViewed` ne régresse jamais** : une demande `responded`/`declined` ne
  redevient pas « consultée » parce que le fournisseur rouvre l'écran.
- **`responded` par mail** (#224) : un destinataire passe aussi `responded` quand
  il répond par mail en joignant un PDF (`markRespondedByMail`, voir
  [`quotes.md`](quotes.md)), sans passer par l'application.
- **Cloisonnement par organisation** : `findForBuyer` filtre sur
  `buyer_organization_id` dans la requête — une demande d'une autre
  organisation est un **404**, pas un 403 (ne pas laisser sonder l'existence
  des demandes d'un concurrent). Idem `findForSupplier`, qui exclut en plus les
  destinataires encore `pending` : tant que l'acheteur n'a pas envoyé, la
  demande n'existe pas pour le fournisseur.

Exceptions dans `app/exceptions/rfq_errors.ts`.

## Permissions (Bouncer)

Trois abilities dans `app/abilities/main.ts`, alignées sur les permissions
`sourcing:*` déjà présentes au seeder (aucune entrée `rfq:*` n'a été ajoutée :
la table `permissions` documente le modèle de rôles, l'autorisation effective
passe par les abilities) :

- **`canCreateRfq`** — organisation `buyer`/`both`, tous rôles jusqu'à `member`
  (miroir de `sourcing:create`) ;
- **`canSendRfq`** — modifier un brouillon, ajouter ou retirer des
  destinataires, publier, envoyer, supprimer un brouillon, valider le panier de
  devis : tous rôles jusqu'à `member` (#216, décision client : « tout le monde
  peut faire une demande de devis »). Les demandes appartiennent à l'agence :
  tout membre voit et peut envoyer celles de ses collègues ;
- **`canManageRfq`** — décider : clôturer, prolonger l'échéance, accepter ou
  rejeter un devis, agir sur une commande : `owner`, `admin`, `manager` (miroir
  de `sourcing:manage`) ;
- **`canRespondToRfq`** — organisation `supplier`/`both`, `owner`/`admin`/
  `manager` : consulter une demande reçue, décliner, et (Phase 4) déposer un
  devis.

## Tests

`tests/functional/rfqs.spec.ts` (18 tests) couvre le service de bout en bout :
création avec items (dont le round-trip `specs`/`jsonb` et le `decimal` relu en
chaîne), remplacement des items, refus de modification après publication,
publication sans item, ajout/retrait de destinataires et rejet des
organisations non fournisseuses ou archivées, envoi partiel puis élargissement
d'une demande publiée, clôture, transitions fournisseur (`viewed`,
`responded`, `declined`) et cloisonnement acheteur/fournisseur.

`tests/functional/rfq_screens.spec.ts` (14 tests) couvre le câblage HTTP :
rendu des trois écrans, cloisonnement par organisation (404), création avec
lignes et destinataires, refus d'une demande sans ligne, publication puis envoi,
ajout/retrait de destinataires, et les deux niveaux d'autorisation (un `member`
rédige mais ne publie pas ; une organisation fournisseuse n'a pas accès aux
écrans acheteur). `tests/inertia/rfqs.spec.ts` (8 tests) vérifie que les actions
n'apparaissent que quand elles sont possibles.

Côté fournisseur, `tests/functional/supplier_rfqs.spec.ts` (9) couvre le
cloisonnement (une demande `pending` ou adressée ailleurs est un 404), l'accusé
de lecture à l'ouverture et sa non-régression, l'absence de `budgetMax` et de
liste de destinataires dans les props, le refus, et les deux portes fermées
(`member` d'un fournisseur, organisation purement acheteuse).
`tests/inertia/supplier_rfqs.spec.ts` (7) vérifie les écrans.
L'envoi des mails est couvert par deux tests de `rfq_screens.spec.ts` (adresse
de contact, puis repli sur les membres habilités — le `member` n'est pas
notifié), un test par niveau de repli dans `tests/unit/quote_address.spec.ts` et
`rfq_mail_locale.spec.ts` (#217), et un test de reconstruction du `kind` dans
`tests/unit/send_mail_job.spec.ts`.

> Sur une **soumission de formulaire**, ni un refus d'autorisation ni une erreur
> de validation ne produisent un 403/422 : Bouncer et VineJS renvoient
> l'utilisateur d'où il vient (302) avec un message ou ses erreurs en session.
> Les specs l'assertent ainsi, avec `.redirects(0)`.

> La spec de service passe par les factories et `useDatabase(group)` (cf. `docs/tests.md`) :
> l'organisation acheteuse, les deux fournisseuses et l'owner viennent de
> `OrganizationFactory` / `createMember`, les RFQ elles-mêmes de `RfqService` —
> c'est justement ses transitions qu'on teste.

## Écrans acheteur (PR 2)

### Routes (`start/routes/rfqs.ts`)

| Méthode | Chemin                            | Nom                      | Rôle requis    |
| ------- | --------------------------------- | ------------------------ | -------------- |
| GET     | `/rfqs`                           | `rfqs.index`             | `canCreateRfq` |
| GET     | `/rfqs/new`                       | `rfqs.create`            | `canCreateRfq` |
| POST    | `/rfqs`                           | `rfqs.store`             | `canCreateRfq` |
| GET     | `/rfqs/:id`                       | `rfqs.show`              | `canCreateRfq` |
| PATCH   | `/rfqs/:id`                       | `rfqs.update`            | `canSendRfq`   |
| POST    | `/rfqs/:id/suppliers`             | `rfqs.suppliers.store`   | `canSendRfq`   |
| DELETE  | `/rfqs/:id/suppliers/:supplierId` | `rfqs.suppliers.destroy` | `canSendRfq`   |
| POST    | `/rfqs/:id/publish`               | `rfqs.publish`           | `canSendRfq`   |
| POST    | `/rfqs/:id/send`                  | `rfqs.send`              | `canSendRfq`   |
| POST    | `/rfqs/:id/close`                 | `rfqs.close`             | `canManageRfq` |

Toutes sont montées dans le groupe `:locale` + `auth` + `onboarded`. C'est le
**premier domaine extrait** dans `start/routes/`, comme le prévoit CLAUDE.md :
`registerRfqRoutes()` est appelée depuis `start/routes.ts`, à l'endroit exact où
vivaient les routes auparavant. Le reste du fichier suivra domaine par domaine.

### Controller

`RfqsController` reste fin : organisation courante → autorisation → validation
→ `RfqService`. Deux particularités :

- **Un refus de transition n'est pas une page d'erreur.** `runTransition()`
  attrape les exceptions listées dans `TRANSITION_ERRORS`, les traduit en
  message flash et renvoie sur l'écran de détail : l'acheteur lit pourquoi son
  action n'a pas abouti sans perdre la page. Toute autre exception remonte.
- **La création tolère un destinataire devenu inéligible** : la demande vient
  d'être enregistrée, on ne la perd pas parce qu'une organisation a été archivée
  entre l'affichage du formulaire et l'envoi — le brouillon est créé, un flash
  d'erreur signale le destinataire ignoré.

### Validation (`app/validators/rfq.ts`)

`rfqValidator` sert à la création **et** à la mise à jour (comme
`supplierProductValidator`) : titre, description, échéance, budget, et **au
moins une ligne** — une demande sans ligne n'est pas chiffrable, `publish` la
refuserait de toute façon. `supplierOrganizationIds` y est facultatif (cocher
des destinataires dès la création). `rfqSuppliersValidator` couvre l'ajout
ultérieur depuis l'écran de détail.

### Transformers

`RfqTransformer` (liste) n'expose que des **compteurs** — lignes, destinataires,
réponses — pour ne pas charger tout le détail sur un écran de liste.
`RfqDetailTransformer` en hérite et ajoute le besoin complet et l'avancement par
destinataire ; `RfqItemTransformer` résout le nom de la catégorie et du produit
référencés dans la locale active (`resolveTranslation`), l'item conservant son
propre `name`.

### Écrans

- **`rfqs/index.vue`** — liste des demandes, statut en pastille, compteurs.
- **`rfqs/create.vue`** — en-tête, lignes du besoin, sélection des destinataires
  en une passe. Enregistre un **brouillon** : rien n'est envoyé à ce stade.
- **`rfqs/show.vue`** — un brouillon est éditable en place (le formulaire est
  réaffiché) ; une demande publiée passe en lecture seule. Les actions
  (`publier`, `envoyer`, `clôturer`) n'apparaissent que lorsqu'elles sont
  possibles, et seulement pour `canManageRfq`.

Composants dans `inertia/components/rfqs/` : `rfq_form`, `rfq_items_fields`,
`rfq_supplier_picker`, `rfq_supplier_list`, `rfq_actions`, plus `types.ts` (état
du formulaire et tonalité des pastilles par statut). Deux composants génériques
en sortent : **`base_badge`** (pastille à tonalité sémantique) et l'extension de
`base_input` au type `date` / de `base_select` aux valeurs numériques.

i18n : `resources/lang/{fr,en}/rfq.json` (66 clés, strictement symétriques).

### Connu, non traité en PR 2

- ~~**Le sélecteur de produit** n'est pas dans l'UI~~ : traité par la demande
  « en un clic » (#55, section ci-dessous).
- ~~Aucune entrée de navigation vers `/rfqs`~~ : traité par le menu applicatif
  (voir `docs/changelog/2026-10-24-shell-applicatif.md`).
- **L'envoi ne notifiait personne** en PR 2 : le mail est arrivé en PR 3.

## Écrans fournisseur et notification (PR 3)

### Routes

| Méthode | Chemin                       | Nom                     | Rôle requis       |
| ------- | ---------------------------- | ----------------------- | ----------------- |
| GET     | `/supplier/rfqs`             | `supplier.rfqs.index`   | `canRespondToRfq` |
| GET     | `/supplier/rfqs/:id`         | `supplier.rfqs.show`    | `canRespondToRfq` |
| POST    | `/supplier/rfqs/:id/decline` | `supplier.rfqs.decline` | `canRespondToRfq` |

Déclarées dans le même `registerRfqRoutes()` que les routes acheteur : c'est un
seul domaine, vu des deux côtés.

### Ce que le fournisseur voit — et ne voit pas

`SupplierRfqType` est volontairement plus pauvre que `RfqDetailType` :

- **pas de `budgetMax`** — le budget plafond est une donnée de négociation
  interne à l'acheteur ; qu'il le saisisse pour cadrer sa demande ne veut pas
  dire qu'il accepte de l'afficher à ceux qui la chiffrent ;
- **pas de liste des destinataires** — un fournisseur consulté n'a pas à savoir
  qui d'autre l'est, ni qui a déjà répondu. Seule _sa_ ligne `rfq_suppliers`
  est exposée, sous le nom `myStatus` ;
- **pas d'agence pour un fournisseur non abonné** (#220) — voir ci-dessous.

### Anonymat de l'agence pour un fournisseur non abonné (#220, #222)

Sans abonnement, la demande est **anonyme** : le fournisseur ne sait pas quelle
agence le consulte et n'a pas ses coordonnées. La règle est celle de
`SubscriptionService#isSubscribed` (cf. `docs/abonnements.md`), jamais recalculée
ailleurs.

| Canal                                                             | Ce que voit un non abonné                                                                                        | Quand la règle est lue |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Écrans « Demandes reçues » (liste, détail) et formulaire de devis | `buyerName` et `buyerLogoUrl` à `null`, mention « Agence anonyme », encart d'abonnement (prop `upsell`)          | à chaque lecture       |
| Mail de demande et relance                                        | objet, titre et introduction sans le nom de l'agence ; encart « abonnez-vous » vers `supplier.subscription.show` | à la mise en queue     |
| Notifications `rfq.received`, `quote.rejected`                    | `buyerName` absent des données ; libellé `notifications.anonymous.*` (`notificationMessageKey`)                  | à la création          |

- La décision se prend **côté serveur** : `SupplierRfqTransformer` reçoit
  `revealBuyer` (faux par défaut) et n'envoie pas la donnée au navigateur.
- Les écrans suivent l'abonnement : s'abonner révèle l'agence sur les demandes
  déjà reçues, l'expiration la masque de nouveau. Un mail ou une notification
  déjà partis restent tels qu'ils ont été écrits.
- L'encart (`SubscriptionUpsell`) propose de souscrire à un propriétaire ou un
  administrateur (`canManageSubscription`) ; il invite les autres à passer par
  eux.
  Dans le mail, le lien mène à la page d'abonnement : un membre sans ce droit y
  est ramené au tableau de bord avec une explication, pas un 403.
- `quote.accepted` et les notifications de commande nomment l'agence : elle passe
  commande et se fait donc connaître.
- **Limite acceptée** (décision client du 16/11/2026) : le titre, la description
  ou une signature saisis par l'agence peuvent la nommer. Ni filtrage, ni
  avertissement.

### Coordonnées de l'agence pour un fournisseur abonné (#221)

Un fournisseur abonné peut contacter l'agence en direct. Il reçoit pour cela le
bloc `BuyerContactType`, construit par `buyerContactOf`
(`shared/helpers/buyer_contact.ts`), un calcul pur partagé par l'écran et les
mails :

| Champ           | Source                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `agencyName`    | `organizations.name`                                                                                |
| `requesterName` | auteur de la demande (`rfqs.created_by_user_id`), `null` s'il est inconnu ou a quitté la plateforme |
| `email`         | `organizations.email`, **à défaut** l'email de l'auteur de la demande                               |
| `phone`         | `organizations.phone`                                                                               |
| `addressLines`  | adresse postale de l'agence, pays nommé dans la langue du lecteur ; vide si rien n'est saisi        |

- **Écran** : `SupplierRfqDetailType.buyerContact` (détail de la demande et
  formulaire de devis), affiché par `SupplierBuyerContact`. `null` pour un non
  abonné : rien ne part vers son navigateur. Comme le nom de l'agence, le bloc
  suit l'abonnement à chaque lecture : un fournisseur qui s'abonne le voit sur
  les demandes reçues avant.
- **Mails** de demande et de relance : `buyerContact` dans la charge du job, lu
  à la mise en queue, rendu par les partiels `emails/partials/buyer_contact`
  (HTML et texte). Les mails déjà partis ne sont pas renvoyés.
- **Auteur** : `rfqs.created_by_user_id` est posé par `RfqService#create`, que
  la demande vienne du formulaire ou du panier (`QuoteCartService#checkout`).
- **Collecte** : l'email de contact se saisit à l'inscription de l'agence
  (champ facultatif `contactEmail` → `organizations.email`, le téléphone l'était
  déjà) et se modifie dans les paramètres de l'organisation, où une agence est
  prévenue qu'il est transmis aux fournisseurs abonnés.
- **Données personnelles** : faute d'email de contact de l'agence, c'est
  l'email **personnel** de l'auteur qui part chez le fournisseur abonné. Les
  coordonnées sont aussi écrites dans la charge des jobs de mail
  (`queue_jobs.payload`) le temps de l'envoi. Les agences doivent en être
  informées dans les mentions légales (#233), avant la mise en production.
- **Effacer** : dans les paramètres, vider l'email, le téléphone ou un champ
  d'adresse efface la valeur (le formulaire envoie toujours ces champs ; un
  champ vide arrive en `null`). Une agence peut ainsi retirer son email de
  contact pour revenir au repli sur l'auteur.

Le cloisonnement lui-même est porté par le service : `listForSupplier` et
`findForSupplier` filtrent sur l'organisation destinataire **et** excluent les
lignes encore `pending`. Une demande préparée mais jamais envoyée n'existe donc
pas pour le fournisseur, et une demande adressée à une autre organisation est un
**404**.

### Accusé de lecture

`RfqService#openForSupplier()` = chargement **et** `sent` → `viewed`
(`RfqRecipientService#applyViewed`), en une passe :
ouvrir l'écran suffit, le fournisseur n'a rien à cliquer et l'acheteur voit
l'avancement. La ligne préchargée est basculée sur place, pour que l'écran
affiche déjà le nouveau statut plutôt que celui d'avant l'ouverture. Rien ne
régresse : une demande `responded`/`declined`/`expired` reste dans son état.

### Notification par mail

`RfqNotificationService` traduit « ces destinataires viennent de passer en
`sent` » en mails mis en queue (`kind` `rfq-received`, cf. [`docs/mail.md`](./mail.md)).
Il est appelé par le listener `OnRfqSent` (l'événement `RfqSent` est publié par
`RfqsController#send`, qui y ajoute la notification in-app), avec **exactement** les lignes que
`RfqService#send` a basculées — élargir une demande déjà publiée puis relancer
`send` ne relance donc pas ceux qui l'avaient déjà reçue.

Destinataires du mail, par ordre de préférence (#217, règle unique
`resolveQuoteAddresses` dans `shared/helpers/quote_address.ts`) :

1. **l'adresse de réception des demandes** (`supplier_profiles.quote_email`),
   que le fournisseur saisit dans son profil (`/supplier/profile`, bloc
   « Réception des demandes de devis »), **une fois confirmée** (voir
   ci-dessous) ;
2. à défaut, **l'adresse de contact de l'organisation** (`organizations.email`) ;
3. à défaut, **les membres `owner`/`admin`/`manager`** — `RFQ_RESPONDER_ROLES`,
   la même constante que celle qu'applique `canRespondToRfq`. Notifier un
   `member`, qui n'a pas accès à l'écran de réponse, serait une impasse.

Une adresse vide ou faite d'espaces compte comme absente.

**Confirmation par lien.** Une adresse de réception saisie ou modifiée n'est pas
utilisée d'emblée : `SupplierProfileService#upsertForOrganization` remet
`quote_email_verified_at` à `null` et `QuoteEmailVerificationService` envoie à
cette adresse un lien de confirmation (mail `quote-email-verification`, valable
7 jours). Le lien est une URL signée qui porte une empreinte HMAC de l'adresse,
sans table de jetons, sur le modèle de la vérification d'email du compte : si
l'adresse change avant le clic, l'ancien lien ne confirme rien. La route
`GET /:locale/supplier/quote-email/verify/:id` (`supplier.quoteEmail.verify`)
est hors `auth`, car la boîte peut être partagée et n'appartenir à aucun compte.
Le profil affiche l'état (« en attente », « confirmée ») et propose de renvoyer
le lien (`POST /:locale/supplier/profile/quote-email/resend`, limité à 5 envois
par heure et par compte). Changer seulement la casse ou les espaces ne compte
pas comme un changement. Les adresses saisies avant cette confirmation ne sont
pas confirmées : elles n'étaient pas utilisées, rien ne change pour elles. Une
faute de frappe ne fait donc plus partir les demandes dans le vide. Une adresse explicite
(niveaux 1 et 2) reçoit un seul mail, dans la langue du membre responsable le
plus ancien ; au niveau 3, chaque membre reçoit le sien dans sa langue. La même
règle alimente l'indicateur admin : la liste `/admin/organizations` signale par
un badge « Sans adresse de réception » les fournisseurs qui tombent au niveau 3
(`quoteAddressSource: 'members'`) et le filtre `missingQuoteAddress=true` ne
montre qu'eux ; la fiche affiche l'état de confirmation de l'adresse. Le filtre
SQL (`withoutQuoteAddress`) traduit la même règle que `quoteAddressSource` : un
test vérifie que les deux désignent exactement les mêmes organisations. Un mail entrant venant de l'adresse de réception est compté comme
expéditeur connu (`inbound_mails.sender_known`).

Le mail suffit à chiffrer (#219) : il reprend la description de la demande et
chaque ligne (produit, référence, variante, quantité, marquage, note de l'agence)
avec ses **prix indicatifs** — unitaire, marquage par pièce, frais techniques,
total — tels que le panier les a figés dans `rfq_items.specs`. Ce sont donc les
mêmes valeurs que celles de l'écran « Demandes reçues » et du panier de l'agence.
Ils sont présentés comme indicatifs : le fournisseur peut proposer mieux. Une
ligne saisie sans prix catalogue l'indique. Le lien vers la plateforme passe en
second, après l'invitation à répondre au mail. La relance reprend le même
contenu, et chaque mail a une version texte (voir `docs/mail.md`).

Un échec de **mise en queue** est loggué en `warn` sans faire échouer la
requête : les statuts sont déjà basculés, la demande apparaît de toute façon
dans l'écran du fournisseur, et faire échouer l'envoi laisserait un état
incohérent pour un canal qui n'est qu'un rappel.

`rfqPath` transite en **relatif** dans la charge du job (`/fr/supplier/rfqs/12`)
et non en URL absolue : la charge est persistée dans `queue_jobs` et peut être
rejouée bien après, éventuellement sous un autre domaine. Le template la préfixe
avec le global `appUrl` de `config/mail.ts`, résolu au rendu.

> **Idempotence des mails** — la dette signalée dans `docs/organisations.md`
> n'est pas aggravée ici. Le double envoi que l'on redoutait (« relancer 20
> fournisseurs ») est empêché par la machine à états : `send` ne bascule que les
> `pending`, un second clic est refusé. Reste le risque commun à tous les mails
> transactionnels — un rejeu après un échec survenu _après_ la remise SMTP
> renvoie **un** mail à **un** destinataire. À traiter avant les devis et les
> commandes (Phase 4), où un doublon a une conséquence commerciale.

### Écrans

- **`supplier/rfqs/index.vue`** — demandes reçues, acheteur, échéance et
  avancement en pastille.
- **`supplier/rfqs/show.vue`** — le besoin, et l'action « décliner » tant que la
  demande est publiée et qu'aucune décision n'a été prise. Une demande déclinée
  ou clôturée par l'acheteur affiche un rappel à la place du bouton.

`rfq_item_list.vue` (lignes du besoin en lecture seule) est **partagé** avec
l'écran acheteur : les deux affichent le même besoin, seule la barre d'actions
diffère.

i18n : section `supplier` de `resources/lang/{fr,en}/rfq.json` (86 clés au
total, strictement symétriques).

### Connu, non traité en PR 3

- ~~Aucune entrée de navigation vers `/supplier/rfqs`~~ : traité par le menu
  applicatif (voir `docs/changelog/2026-10-24-shell-applicatif.md`).
- ~~**Le mail est en français seulement**~~ : traité par #58, chaque destinataire
  reçoit la demande dans sa langue (voir `docs/mail.md`, « Langue du destinataire »).
- **Le dépôt de devis** est annoncé à l'écran mais n'existe pas : c'est la
  Phase 4 (#5), `markResponded` en est le point d'accroche.

## Roadmap

Découpage de la Phase 3 en 3 PR :

1. **PR 1 — Socle backend** (ce document) : migrations, modèles, types, service,
   exceptions, abilities, tests.
2. **PR 2 — Écrans acheteur** (section ci-dessus) — fait : validators,
   transformers, `RfqsController`, `start/routes/rfqs.ts`, pages
   `rfqs/{index,create,show}.vue`, composants, i18n FR/EN, tests.
3. **PR 3 — Écrans fournisseur** (section ci-dessus) — fait :
   `supplier/rfqs/{index,show}.vue`, accusé de lecture, refus, notification des
   destinataires par mail (`kind` `rfq-received` de `SendMailJob`).

La Phase 3 est complète : l'issue #4 est close.

**Connu, non traité :**

- **Suppression d'un brouillon** — non exposée (l'issue #4 ne prévoit pas de
  route `DELETE`) ; à trancher avec l'écran de la PR 2.
- **Idempotence des mails** — dette signalée dans `docs/organisations.md`, non
  aggravée par la notification RFQ (voir l'encadré ci-dessus) ; à régler avant
  les devis et les commandes.
- **Devis** — traités par la Phase 4 (#5) : voir [`quotes.md`](quotes.md).
  `markResponded` est appelé à la remise du devis.

## Demande « en un clic » depuis le catalogue (#55)

Le pitch promet une demande de devis en un clic : une fiche produit mène à un
formulaire déjà rempli, et le formulaire sait chercher dans le catalogue.

### Depuis une fiche produit

> **Remplacé par le panier de devis (2026-11-11)** : la fiche produit propose
> désormais « Ajouter au panier de devis », et le menu « Ajouter à une demande
> en brouillon » a disparu. `rfqContext` vaut `{ canCreateRfq, inCart }`. Le
> formulaire pré-rempli reste accessible par le lien « Demande détaillée »
> (`rfqs.create?productId=`). Voir [`quote-cart.md`](quote-cart.md).

### Routes

| Route                                       | Nom                       | Rôle                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /:locale/rfqs/new?productId=`          | `rfqs.create`             | pré-remplit une ligne (désignation, catégorie, quantité = `min_quantity`, sinon 1) et coche le fournisseur du produit. Un produit inconnu, inactif, rejeté ou d'une organisation archivée ouvre un formulaire vide                                                   |
| `POST /:locale/rfqs/:id/items/from-product` | `rfqs.items.from_product` | ajoute le produit comme **nouvelle ligne** d'un brouillon et son fournisseur aux destinataires. Corps : `{ productId }` seul — nom, catégorie, quantité et fournisseur sont relus côté serveur. Brouillon uniquement (`RfqNotEditableException` sinon), `canSendRfq` |
| `DELETE /:locale/rfqs/:id`                  | `rfqs.destroy`            | supprime un brouillon (lignes et destinataires partent en `CASCADE`). Une demande publiée ou close n'est jamais supprimée — elle se clôture. `canSendRfq`                                                                                                            |

`RfqService` gagne `addProductItem`, `delete` et `listDrafts`. Ajouter deux fois
le même produit crée deux lignes (deux quantités, deux marquages) mais un seul
destinataire — l'unicité `(rfq_id, supplier_organization_id)` s'applique.

Un produit dont la fiche fournisseur n'est pas rattachée à une organisation
(`suppliers.organization_id` nul, import en masse non traité) donne une ligne
sans destinataire : il n'y a personne à consulter.

### Garanties

- **Tout ou rien** : `addProductItem` vérifie l'éligibilité du fournisseur avant
  d'écrire, puis écrit la ligne et le destinataire dans une transaction. Le
  statut du brouillon est relu sous verrou (`FOR UPDATE`) : une demande publiée
  dans un autre onglet entre-temps ne reçoit pas de ligne. Un fournisseur
  inéligible (non fournisseur, archivé) donne un message flash et rien d'écrit.
- **`productId` jamais cru sur parole** : à la création comme à l'enregistrement
  d'un brouillon, un `productId` inconnu, inactif, rejeté ou d'une organisation
  archivée est ramené à `null` (`RfqService#withRequestableProducts`). La ligne
  survit par son `name`, comme à la suppression d'un produit, et un brouillon dont
  un produit a quitté le catalogue reste enregistrable.
- **Paramètres de requête validés** (`rfqLookupQueryValidator`) : `productId` et
  `productSearch` invalides (`12abc`, tableau, négatif) sont ignorés, le
  formulaire s'ouvre vide.

### Sélecteur de produit

`components/rfqs/rfq_product_picker.vue`, dans `rfq_form.vue` (création **et**
édition d'un brouillon). La recherche est un **partial reload Inertia** de la
page courante (`router.reload({ only: ['productResults'] })`), pas du JSON : les
contrôleurs `create` et `show` exposent `productResults` en prop **optionnelle**
(`inertia.optional`), évaluée seulement quand le client la demande, à partir du
paramètre `?productSearch=` (2 caractères minimum, 100 maximum, 8 résultats ; le nom est cherché dans toutes les langues de contenu, le full-text dans celle de l'interface). L'URL n'en
garde pas la trace (`preserveUrl`). Le sélecteur n'affiche une liste que si
elle correspond à la saisie courante : pas de résultats périmés pendant la frappe.

> L'issue prévoyait une route dédiée `GET /products/lookup`. Elle ne
> fonctionnerait pas en partial reload (qui ne rejoue que la page courante) et
> entrerait en collision avec `products/:slug` : la recherche vit donc sur les
> pages du formulaire.

Choisir un produit ajoute une ligne (`itemFromProduct`). À la création son
fournisseur est coché ; en édition, les destinataires se gèrent hors du
formulaire : l'écran de détail pré-coche le fournisseur dans « Ajouter des
destinataires » (événement `product-picked`), l'acheteur valide d'un clic.

Le formulaire **conserve désormais `productId`** à l'enregistrement. Avant #55 il
ne l'envoyait pas, et un brouillon réenregistré perdait le lien avec le
catalogue. `rfq_item_list.vue` affiche un lien vers la fiche produit quand
`productSlug` est renseigné.

### Recherche : Meilisearch (#112)

Le sélecteur passe par `ProductSearchService#lookup` : recherche par **mots-clés
seuls** dans l'index Meilisearch (pas d'appel au provider d'embeddings à chaque
frappe), puis **rechargement des produits depuis PostgreSQL** — uniquement des
produits _visibles_ (actifs, organisation vivante, non rejetés), au plus `limit`
résultats, nom localisé dans la langue de l'interface.

Si Meilisearch est inerte (pas de `MEILISEARCH_HOST`) ou injoignable,
`lookup` renvoie `null`, `RfqsController` envoie `productResults: null` et
`rfq_product_picker.vue` affiche « recherche indisponible » (`rfq.product.unavailable`)
au lieu de « aucun produit trouvé » : il n'y a plus de repli PostgreSQL
(`lookupForRfq` a été retiré avec la PR 3 de #112). `findForRfq` (pré-remplissage par
identifiant) reste sur PostgreSQL : ce n'est pas une recherche. Détail :
[`search.md`](search.md).

### Tests

- `tests/functional/rfq_one_click.spec.ts` : pré-remplissage, `rfqContext`
  (acheteur, `member`, visiteur, fournisseur), ajout à un brouillon (refus sur
  publiée, produit inconnu, autre organisation), sélecteur (partial reload,
  saisie courte, produits inactifs), suppression (brouillon, publiée, `member`,
  autre organisation).
- `tests/inertia/product_quote_actions.spec.ts`, `rfq_product_picker.spec.ts`.
- i18n : `rfq.product.*`, `rfq.actions.delete`/`confirmDelete`,
  `rfq.flash.productAdded`/`deleted`, `rfq.errors.notDeletable`,
  `rfq.show.viewProduct`, `products.show.signInToRequest`, dans les 9 langues
  (`products.show.addToDraft`/`chooseDraft` retirées avec le panier de devis).

## Expiration, prolongation et relance (#56)

`rfqs.deadline` n'est plus décorative : elle fait expirer la demande, et un
fournisseur qui n'a pas répondu est relancé une fois. Le parcours par mail
(#232) a recentré la relance sur l'absence de **réponse** (plus d'ouverture),
ajouté le statut `expired` par destinataire et la réponse tardive.

### Statut `expired`

`RFQ_STATUSES` gagne `expired` (migration `…alter_rfqs_add_expiration_and_reminders` :
contrainte CHECK élargie, colonne `rfqs.expired_at`). Comme `closed`, une demande
échue n'accepte plus d'envoi, de nouveau destinataire ni de réponse du
fournisseur (`decline`, `markResponded`) ; contrairement à `closed`, l'acheteur
peut la **rouvrir** en prolongeant l'échéance. Les destinataires restés **sans
réponse** (`sent`, `viewed`) passent `expired` dans la même transaction (#232) ;
leur statut d'avant est gardé dans `rfq_suppliers.expired_from`. Ceux qui ont
répondu ou décliné gardent leur statut. Côté fournisseur la demande reste
consultable, avec la mention « échue » et la pastille « Expirée » ; côté acheteur
elle a sa pastille « Échue », ses destinataires « Expirée sans réponse », et son
compteur sur le tableau de bord. `close` reste possible avant l'échéance.

Migration `…038_add_expiration_to_rfq_suppliers` : contrainte CHECK de
`rfq_suppliers.status` élargie à `expired`, colonnes `expired_from` et
`late_reply_at`. Son `down()` rend aux destinataires expirés leur statut d'avant.

**Quand une demande est-elle échue ?** L'échéance est une _date_ saisie par
l'acheteur : « 30 octobre » laisse toute la journée du 30 aux fournisseurs, la
demande est échue le **31 à 00:00, heure de Paris** (`RFQ_DEADLINE_TIMEZONE`).
`RfqDeadlineService#expireDue` compare l'échéance à minuit (Paris) du jour courant
(`startOfDeadlineDay`). Un
brouillon, une demande close ou sans échéance n'expirent jamais.

`ExpireRfqsJob` (`app/jobs/expire_rfqs_job.ts`) appelle `expireDue` tous les jours
à **00:10 (Europe/Paris)**, juste après minuit pour que le statut soit juste dès le
matin. Voir `docs/queue.md`.

Garde-fous : la bascule est un `UPDATE … WHERE status = 'published'` (et échéance
dépassée pour le lot) — une demande close ou prolongée entre la lecture et
l'écriture n'est jamais écrasée ; un échec isolé est loggué sans interrompre le
lot. Entre minuit et le passage du job (ou s'il tarde), `decline` et
`markResponded` refusent déjà une demande dont l'échéance est passée. L'échéance
est interprétée en heure de Paris, quel que soit le fuseau du serveur. Le compteur
« non lues » du tableau de bord fournisseur ne compte que les demandes encore
publiées.

### Prolonger l'échéance

`PATCH /:locale/rfqs/:id/deadline` (`rfqs.deadline.update`, `canManageRfq`) →
`RfqDeadlineService#extendDeadline`. Corps : `{ deadline: 'AAAA-MM-JJ' }`. Seule
`deadline` change — jamais le besoin : c'est l'exception à « seul un brouillon est
modifiable », assumée parce qu'elle ne fausse aucun devis. Règles :

- la demande est `published` ou `expired` (`RfqNotExtendableException` sinon) ;
- la nouvelle date n'est pas passée **et** est strictement postérieure à
  l'échéance actuelle (`RfqInvalidDeadlineException`) — « prolonger » ne
  raccourcit jamais ;
- sur une demande `expired`, la nouvelle date la **rouvre** : elle repasse
  `published`, `expired_at` est remis à `NULL`, les fournisseurs peuvent répondre de
  nouveau, et chaque destinataire `expired` retrouve son statut d'avant
  (`expired_from`, à défaut `sent`). Dans tous les cas, `reminded_at` des
  destinataires toujours sans réponse est remis à `NULL` : la nouvelle échéance
  ouvre droit à une nouvelle relance.

UI : `components/rfqs/rfq_deadline_extension.vue` sur `rfqs/show.vue` (champ date +
bouton « Prolonger l'échéance », avec une explication quand la demande est échue).
Un refus revient en message flash, comme les autres transitions.

### Relance des fournisseurs sans réponse

`RemindRfqSuppliersJob` (tous les jours à **09:00, Europe/Paris**) relance les
destinataires que renvoie `RfqRecipientService#remindableRecipients` (#232) — le même
prédicat sert à la relance manuelle de la plateforme et à son compteur — et qui :

- ont reçu la demande et **n'ont pas répondu** : statut `sent` ou `viewed`, et
  **aucun message côté fournisseur** dans le fil de la demande (une réponse par
  mail sans devis ne change pas le statut, mais elle compte). Ouvrir la demande ne
  compte plus : un fournisseur qui travaille par mail, ou une fiche sans compte,
  ne l'« ouvre » jamais. Un message masqué par la modération compte quand même :
  le fournisseur a bien répondu. Répondus, déclinés et expirés ne sont jamais relancés ;
- l'ont reçue il y a au moins `RFQ_REMINDER_AFTER_DAYS` jours (3, dans
  `shared/types/rfq.ts`) ;
- n'ont pas déjà été relancés (`rfq_suppliers.reminded_at` nul) ;
- sur une demande encore ouverte : publiée et dont l'échéance n'est pas passée.

**Une seule relance** : `reminded_at` est posé après la mise en queue du mail
(`RfqRecipientService#markReminded`, une seule requête pour le lot). Il n'est consigné que si
**toutes** ses adresses sont parties en queue ; sinon il est reconsidéré le
lendemain (les adresses déjà parties ne sont pas redoublées). Au déploiement, les
destinataires déjà silencieux depuis plus de 3 jours sur une demande ouverte sont
relancés au premier passage. En plus, le mail porte une clé
d'idempotence `rfq-reminder:rfq=…:org=…:to=…` : un rejeu de la queue ne le
renvoie pas. Le mail (`kind: 'rfq-reminder'`, `RfqReminderNotification`,
`emails/rfq_reminder`) part dans la langue de chaque destinataire, avec les mêmes
règles que `rfq-received` (voir `docs/mail.md`) : même contenu, même anonymisation
pour un non abonné, même `Reply-To` relais. Une fiche sans compte est relancée une
fois, à l'adresse de l'organisation.

### Réponse tardive (#232)

Après l'échéance, l'adresse relais reste valide (`INBOUND_MAIL_GRACE_DAYS` jours
après l'expiration, cf. `docs/mail.md`) : une réponse par mail est **enregistrée
quand même** (message, pièces jointes, devis), mais marquée **tardive**. C'est
l'**heure de réception** du mail (`inbound_mails.received_at`) qui compte, pas celle
de son traitement : un mail reçu à 23:55 le jour de l'échéance et repris après
minuit (`RecoverInboundMailsJob`, rejeu admin) arrive dans les temps, même si la
demande a expiré entre-temps. Règle pure `isLateReply`
(`shared/helpers/rfq_deadline.ts`) : avec une échéance, tardive si elle est passée
au jour de réception ; sans échéance, seulement si la demande a été expirée à la
main. Une demande close n'attend plus rien : ce qui arrive après n'est pas tardif.

- `RfqRecipientService#markLateReply` date la **première** réponse tardive
  (`rfq_suppliers.late_reply_at`, à son heure de réception) ;
- avec un devis PDF, `markRespondedByMail` fait passer le destinataire
  `responded`, y compris depuis `expired` (refusé pour une demande close) ;
- l'événement `SupplierReplyRecorded` porte `late` ; le listener
  `on_supplier_reply_recorded` le transmet : le mail `supplier-reply-received`
  change d'objet (« Réponse tardive de … ») et porte une mention dans son corps, la
  notification in-app `rfq.responded` prend le libellé `notifications.late.rfq.responded`
  (`notificationMessageKey`), dans les 9 langues ;
- les écrans affichent la pastille « Réponse tardive » à côté du statut
  (`components/rfqs/rfq_recipient_status_badges.vue`) : côté agence sur la liste
  des destinataires (`RfqSupplierType.lateReply`), côté fournisseur sur la liste et
  le détail des demandes reçues (`SupplierRfqType.myLateReply`).

Pas de notification de l'acheteur à l'expiration : il voit le statut dans sa liste
et son tableau de bord. Les notifications in-app (#57) ne couvrent pas non plus
l'expiration ni la relance : seulement l'envoi, le refus et les devis.

### Tests

`tests/functional/rfq_expiration.spec.ts` (expiration à la date et à la limite du
jour, demandes jamais expirées, job, destinataires expirés et restaurés à la
réouverture, droits, vue fournisseur, relance unique et langue, ni répondus par
mail ni expirés relancés, fiche sans compte relancée une fois, réponse tardive
enregistrée et signalée), `tests/inertia/rfq_deadline_extension.spec.ts`,
`tests/inertia/rfqs.spec.ts` et `supplier_rfqs.spec.ts` (pastilles),
`tests/unit/mail_templates.spec.ts` (mail de relance dans les 9 langues, mention
tardive), `tests/unit/rfq_deadline.spec.ts`, `tests/unit/notification_message_key.spec.ts`,
`tests/unit/transformers/rfq_supplier_transformer.spec.ts` et
`supplier_rfq_transformer.spec.ts`.
