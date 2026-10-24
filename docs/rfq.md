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

## Cycle de vie (`RfqService`)

```
draft ──publish──▶ published ──close──▶ closed
                       │
                       └──send──▶ destinataires `pending` → `sent`
```

**`publish` et `send` sont deux transitions distinctes**, volontairement :
publier fige le besoin, envoyer notifie les destinataires. Un acheteur peut
ajouter un fournisseur à une demande déjà publiée puis relancer `send` — seuls
les `pending` basculent, personne n'est relancé deux fois. `send` renvoie
exactement les lignes basculées (relation `supplierOrganization` préchargée) :
c'est cette liste que `RfqNotificationService` utilise pour envoyer les mails,
sans risque de doublon.

Règles appliquées par le service :

| Méthode                    | Autorisée si                                          | Exception sinon              |
| -------------------------- | ----------------------------------------------------- | ---------------------------- |
| `update`, `replaceItems`   | `draft`                                               | `RfqNotEditableException`    |
| `addSuppliers`             | statut ≠ `closed`                                     | `RfqNotEditableException`    |
| `removeSupplier`           | destinataire encore `pending`                         | `RfqNotEditableException`    |
| `publish`                  | `draft` **et** au moins un item                       | `RfqNotPublishableException` |
| `send`                     | `published` **et** au moins un destinataire `pending` | `RfqNotSendableException`    |
| `close`                    | `published`                                           | `RfqNotClosableException`    |
| `markResponded`, `decline` | destinataire `sent`/`viewed`                          | `RfqNotEditableException`    |

Autres invariants :

- **Un brouillon seul est modifiable.** Une demande partie chez un fournisseur
  ne se réécrit pas silencieusement : les devis reçus porteraient sur un besoin
  qui n'existe plus.
- **On ne retire pas un destinataire déjà notifié** — cela effacerait la trace
  de l'envoi. L'acheteur clôture la demande à la place.
- **Destinataires éligibles** : organisations `supplier`/`both` **non
  archivées** uniquement (`NotASupplierOrganizationException`) ; une
  organisation acheteuse n'a aucun écran pour répondre, une organisation
  archivée n'a plus personne pour lire.
- **`markViewed` ne régresse jamais** : une demande `responded`/`declined` ne
  redevient pas « consultée » parce que le fournisseur rouvre l'écran.
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
- **`canManageRfq`** — modifier, publier, envoyer, clôturer : `owner`, `admin`,
  `manager` (miroir de `sourcing:manage`). Un `member` rédige un brouillon mais
  ne l'envoie pas aux fournisseurs ;
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
notifié) et un test de reconstruction du `kind` dans
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
| PATCH   | `/rfqs/:id`                       | `rfqs.update`            | `canManageRfq` |
| POST    | `/rfqs/:id/suppliers`             | `rfqs.suppliers.store`   | `canManageRfq` |
| DELETE  | `/rfqs/:id/suppliers/:supplierId` | `rfqs.suppliers.destroy` | `canManageRfq` |
| POST    | `/rfqs/:id/publish`               | `rfqs.publish`           | `canManageRfq` |
| POST    | `/rfqs/:id/send`                  | `rfqs.send`              | `canManageRfq` |
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

- **Le sélecteur de produit** n'est pas dans l'UI : une ligne se cadre par
  catégorie ou reste libre. `rfq_items.product_id` et le validateur l'acceptent
  déjà — il manque un composant de recherche dans le catalogue.
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
  est exposée, sous le nom `myStatus`.

Le cloisonnement lui-même est porté par le service : `listForSupplier` et
`findForSupplier` filtrent sur l'organisation destinataire **et** excluent les
lignes encore `pending`. Une demande préparée mais jamais envoyée n'existe donc
pas pour le fournisseur, et une demande adressée à une autre organisation est un
**404**.

### Accusé de lecture

`openForSupplier()` = chargement **et** `sent` → `viewed`, en une passe :
ouvrir l'écran suffit, le fournisseur n'a rien à cliquer et l'acheteur voit
l'avancement. La ligne préchargée est basculée sur place, pour que l'écran
affiche déjà le nouveau statut plutôt que celui d'avant l'ouverture. Rien ne
régresse : une demande `responded`/`declined` reste dans son état.

### Notification par mail

`RfqNotificationService` traduit « ces destinataires viennent de passer en
`sent` » en mails mis en queue (`kind` `rfq-received`, cf. [`docs/mail.md`](./mail.md)).
Il est appelé par `RfqsController#send`, avec **exactement** les lignes que
`RfqService#send` a basculées — élargir une demande déjà publiée puis relancer
`send` ne relance donc pas ceux qui l'avaient déjà reçue.

Destinataires du mail, par ordre de préférence :

1. **l'adresse de contact de l'organisation** (`organizations.email`), celle que
   le fournisseur a lui-même déclarée pour être joint ;
2. à défaut, **les membres `owner`/`admin`/`manager`** — `RFQ_RESPONDER_ROLES`,
   la même constante que celle qu'applique `canRespondToRfq`. Notifier un
   `member`, qui n'a pas accès à l'écran de réponse, serait une impasse.

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
- **Le mail est en français seulement**, comme le mail d'invitation : le worker
  n'a pas de locale, et les templates Edge ne sont pas traduits.
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
- **Devis** — la réponse fournisseur (`quotes`) est la Phase 4 (#5) ;
  `markResponded` est le point d'accroche prévu.
