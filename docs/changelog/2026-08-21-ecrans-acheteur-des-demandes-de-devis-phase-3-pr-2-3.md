# Écrans acheteur des demandes de devis — Phase 3, PR 2/3 (#4)

> Date : 2026-08-21

Le socle RFQ (PR 1) devient utilisable : un acheteur décrit un besoin,
sélectionne des fournisseurs, publie puis envoie sa demande depuis l'interface.

- **Trois écrans** — `rfqs/index.vue` (liste, statut en pastille, compteurs
  lignes / destinataires / réponses), `rfqs/create.vue` (en-tête, lignes du
  besoin et destinataires en une passe, enregistrés en **brouillon**) et
  `rfqs/show.vue` (brouillon éditable en place, demande publiée en lecture
  seule, actions selon le statut).
- **`RfqsController`** — controller fin ; `start/routes/rfqs.ts` est le
  **premier domaine extrait** dans `start/routes/`, comme le prévoit CLAUDE.md
  (le fichier de routes monolithique suivra domaine par domaine).
- **Un refus de transition n'est pas une page d'erreur** : les exceptions du
  service sont traduites en message flash et l'écran de détail reste affiché —
  l'acheteur lit pourquoi son action n'a pas abouti. Toute exception hors de
  cette table remonte en 500.
- **Deux niveaux d'autorisation à l'écran** : `canCreateRfq` pour consulter et
  rédiger (jusqu'au rôle `member`), `canManageRfq` pour publier, envoyer et
  clôturer. La prop `canManageRfq` masque les actions que l'utilisateur ne peut
  pas déclencher, le contrôleur les refusant de toute façon.
- **Transformers** — `RfqTransformer` (liste) n'expose que des compteurs ;
  `RfqDetailTransformer` en hérite pour le détail ; `RfqItemTransformer` résout
  le nom de la catégorie et du produit référencés dans la locale active.
- **Composants génériques extraits** : `base_badge` (pastille à tonalité
  sémantique), `base_input` accepte `type="date"`, `base_select` accepte des
  valeurs numériques — le formulaire n'a donc pas à convertir ses identifiants
  en chaînes comme le fait encore le formulaire produit.
- **i18n** : `resources/lang/{fr,en}/rfq.json` (66 clés, symétriques).
- **Tests** — `tests/functional/rfq_screens.spec.ts` (+12) et
  `tests/inertia/rfqs.spec.ts` (+8). À noter, asserté comme tel : sur une
  soumission de formulaire, Bouncer et VineJS **redirigent** (302) au lieu de
  répondre 403/422.
- **Connu, non traité** : pas de sélecteur de produit dans l'UI (une ligne se
  cadre par catégorie ou reste libre — la colonne et le validateur l'acceptent
  déjà) ; aucune entrée de navigation vers `/rfqs` (le layout n'a pas de menu
  applicatif) ; l'envoi ne notifie encore personne, le mail est l'objet de la
  PR 3.
- **Doc** : `docs/rfq.md` § « Écrans acheteur (PR 2) ».
