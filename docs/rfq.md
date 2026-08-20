# Demandes de devis (RFQ)

Socle backend de la **Phase 3** (#4) : permettre à une organisation acheteuse
de décrire un besoin, de le détailler ligne par ligne, et de le soumettre
simultanément à plusieurs organisations fournisseuses.

Décision d'organisation reprise de la Phase 2 (#3) : **un fournisseur = une
organisation** de type `supplier`/`both`, multi-utilisateurs. Les deux côtés
d'une RFQ pointent donc vers `organizations` — `rfqs.buyer_organization_id` et
`rfq_suppliers.supplier_organization_id` — et non vers la fiche catalogue
`suppliers`, qui n'a pas d'utilisateur pour répondre.

> Ce document couvre la **fondation backend** (PR 1/3) : tables, modèles,
> service, abilities. Les contrôleurs, routes et écrans arrivent dans les PR
> suivantes (voir [Roadmap](#roadmap)).

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

> La spec passe par les factories et `useDatabase(group)` (cf. `docs/tests.md`) :
> l'organisation acheteuse, les deux fournisseuses et l'owner viennent de
> `OrganizationFactory` / `createMember`, les RFQ elles-mêmes de `RfqService` —
> c'est justement ses transitions qu'on teste.

## Roadmap

Découpage de la Phase 3 en 3 PR :

1. **PR 1 — Socle backend** (ce document) : migrations, modèles, types, service,
   exceptions, abilities, tests.
2. **PR 2 — Écrans acheteur** : validators VineJS, `RfqTransformer`,
   `RfqsController`, `start/routes/rfqs.ts`, pages `rfqs/{index,create,show}.vue`,
   i18n FR/EN, tests fonctionnels HTTP.
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
