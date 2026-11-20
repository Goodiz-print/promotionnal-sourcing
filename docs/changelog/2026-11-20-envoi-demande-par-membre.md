# Tout membre d'une agence peut envoyer une demande de devis

> Date : 2026-11-20

Issue #216. Le client l'a demandé : « tout le monde peut faire une demande de devis ». Un utilisateur de rôle `member` envoie désormais ses demandes lui-même ; elles ne restent plus en brouillon en attendant un responsable.

- **Nouvelle ability `canSendRfq`** (owner, admin, manager, member d'une organisation acheteuse). Elle couvre la validation du panier de devis (demandes publiées et envoyées aux fournisseurs), la modification d'un brouillon, l'ajout ou le retrait de destinataires, la publication, l'envoi et la suppression d'un brouillon.
- **`canManageRfq` reste réservée aux responsables** (owner, admin, manager) pour les décisions : clôturer une demande, prolonger l'échéance, accepter ou rejeter un devis, agir sur une commande.
- **Écrans** : la page de détail d'une demande reçoit `canSendRfq` en plus de `canManageRfq`. Un membre voit Publier, Envoyer, Supprimer le brouillon, l'édition du besoin et la gestion des destinataires, mais pas Clôturer ni la prolongation d'échéance.
- **Inchangé** : un visiteur non connecté ne peut toujours pas demander de devis. Les demandes restent visibles par toute l'agence.
- **Tests** : `quote_cart.spec.ts` (un membre envoie ses demandes), `rfq_screens.spec.ts` (un membre publie, ne clôture pas), `rfq_one_click.spec.ts` (un membre supprime un brouillon), `tests/inertia/rfqs.spec.ts`.
- **Documentation** : `docs/rfq.md` (droits et routes) et `docs/quote-cart.md`.
