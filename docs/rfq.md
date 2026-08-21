# Demandes de devis (RFQ)

Socle backend de la **Phase 3** (#4) : permettre à une organisation acheteuse
de décrire un besoin, de le détailler ligne par ligne, et de le soumettre
simultanément à plusieurs organisations fournisseuses.

Décision d'organisation reprise de la Phase 2 (#3) : **un fournisseur = une
organisation** de type `supplier`/`both`, multi-utilisateurs. Les deux côtés
d'une RFQ pointent donc vers `organizations` — `rfqs.buyer_organization_id` et
`rfq_suppliers.supplier_organization_id` — et non vers la fiche catalogue
`suppliers`, qui n'a pas d'utilisateur pour répondre.

> Ce document couvre la **fondation backend** (PR 1/3) et les **écrans
> acheteur** (PR 2/3). Le côté fournisseur et la notification par mail arrivent
> en PR 3 (voir [Roadmap](#roadmap)).

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
c'est cette liste que la PR 3 utilisera pour dispatcher les mails, sans risque
de doublon.

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

`tests/functional/rfq_screens.spec.ts` (12 tests) couvre le câblage HTTP :
rendu des trois écrans, cloisonnement par organisation (404), création avec
lignes et destinataires, refus d'une demande sans ligne, publication puis envoi,
ajout/retrait de destinataires, et les deux niveaux d'autorisation (un `member`
rédige mais ne publie pas ; une organisation fournisseuse n'a pas accès aux
écrans acheteur). `tests/inertia/rfqs.spec.ts` (8 tests) vérifie que les actions
n'apparaissent que quand elles sont possibles.

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
- **Aucune entrée de navigation** vers `/rfqs` : le layout n'a pas de menu
  applicatif, les écrans se rejoignent par URL comme ceux des produits.
- **L'envoi ne notifie personne** : `send` bascule les statuts, le mail est
  l'objet de la PR 3.

## Roadmap

Découpage de la Phase 3 en 3 PR :

1. **PR 1 — Socle backend** (ce document) : migrations, modèles, types, service,
   exceptions, abilities, tests.
2. **PR 2 — Écrans acheteur** (section ci-dessus) — fait : validators,
   transformers, `RfqsController`, `start/routes/rfqs.ts`, pages
   `rfqs/{index,create,show}.vue`, composants, i18n FR/EN, tests.
3. **PR 3 — Écrans fournisseur** : `supplier/rfqs/{index,show}.vue`, accusé de
   lecture, refus, notification des destinataires par mail (nouveau `kind` de
   `SendMailJob`, cf. `docs/mail.md`).

**Connu, non traité :**

- **Suppression d'un brouillon** — non exposée (l'issue #4 ne prévoit pas de
  route `DELETE`) ; à trancher avec l'écran de la PR 2.
- **Idempotence des mails** — dette signalée dans `docs/organisations.md` :
  bénigne pour une invitation, à régler avant de notifier des RFQ en masse
  (PR 3).
- **Devis** — la réponse fournisseur (`quotes`) est la Phase 4 (#5) ;
  `markResponded` est le point d'accroche prévu.
