# Socle backend des demandes de devis (RFQ) — Phase 3, PR 1/3 (#4)

> Date : 2026-08-20

Première brique de la Phase 3 : une organisation acheteuse peut décrire un
besoin et le soumettre à plusieurs organisations fournisseuses. Cette PR pose
les données et les règles de transition ; les écrans arrivent en PR 2 (acheteur)
et PR 3 (fournisseur).

- **Trois tables** — `rfqs` (demande : statut `draft`/`published`/`closed`,
  échéance, budget max, auteur en `SET NULL`), `rfq_items` (le besoin ligne à
  ligne : `category_id` et `product_id` **tous deux nullables et indépendants**
  — produit du catalogue, catégorie, ou besoin libre — et `specs jsonb`) et
  `rfq_suppliers` (pivot **avec statut par destinataire** : `pending` → `sent`
  → `viewed` → `responded`/`declined`, unicité `(rfq_id,
supplier_organization_id)`). Les deux côtés pointent vers `organizations`,
  conformément à la décision de #3 (« un fournisseur = une organisation ») —
  pas vers la fiche catalogue `suppliers`, qui n'a pas d'utilisateur pour
  répondre.
- **`RfqService`** (`app/services/rfq_service.ts`) — `publish` et `send` sont
  **deux transitions distinctes** : publier fige le besoin, envoyer notifie les
  destinataires en attente. Un acheteur peut donc élargir une demande déjà
  publiée et relancer `send` sans relancer ceux qui l'ont déjà reçue — `send`
  ne renvoie que les lignes réellement basculées (relation préchargée), ce qui
  donnera en PR 3 la liste exacte des mails à dispatcher.
- **Invariants** — seul un brouillon est modifiable ; un destinataire déjà
  notifié ne peut plus être retiré (l'acheteur clôture à la place) ; seules des
  organisations `supplier`/`both` **non archivées** peuvent être destinataires ;
  `markViewed` ne fait jamais régresser un statut terminal. Le cloisonnement est
  dans la requête : une demande d'une autre organisation est un **404**, pas un 403. Exceptions dédiées dans `app/exceptions/rfq_errors.ts`.
- **Abilities** — `canCreateRfq` (org acheteuse, jusqu'au rôle `member`),
  `canManageRfq` (publier/envoyer/clôturer : `owner`/`admin`/`manager`),
  `canRespondToRfq` (org fournisseuse). Alignées sur les permissions
  `sourcing:*` déjà seedées : **aucune entrée `rfq:*` ajoutée** — la table
  `permissions` documente le modèle de rôles, l'autorisation effective passe par
  les abilities.
- **`RfqItem.specs`** est la seule colonne du projet redéclarée avec son
  décorateur (`prepare`/`consume`) : le schéma généré la type `any`, et `jsonb`
  revient en objet sous Postgres mais en texte sous SQLite.
- **Tests** — `tests/functional/rfqs.spec.ts` (+18) : cycle complet, refus de
  modification après publication, publication sans item, destinataires
  inéligibles, envoi partiel puis élargissement, transitions fournisseur,
  cloisonnement. Suite complète : 186 tests au vert.
- **Doc** : `docs/rfq.md` (tables, cycle de vie, invariants, permissions,
  roadmap Phase 3).
