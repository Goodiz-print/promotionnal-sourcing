# Plus aucun `window.confirm` : toutes les confirmations dans le design system

> Date : 2026-11-25

Suite de #291 : toutes les confirmations restantes de l'application passent par `useConfirm()` (fenêtre `BaseConfirmDialog` rendue par `ConfirmDialogHost`) au lieu de la boîte native du navigateur. `grep -rn "window.confirm" inertia` ne renvoie plus rien.

## Comportement

- Chaque fenêtre reprend le message existant et nomme son bouton par le libellé de l'action (« Supprimer », « Archiver », « Rejouer »…), plus un « Confirmer » générique.
- Ton `danger` (bouton rouge, focus initial sur « Annuler ») pour les actions irréversibles ou destructives : suppressions (attributs, valeurs, certifications, techniques de marquage, catégories, produits, contacts, documents, passkeys, campagnes), retrait de membre, révocation d'invitation, quitter / archiver une organisation, suppression de compte, suspension et suppression d'un utilisateur, archivage produit et organisation, résiliation d'abonnement, détachement d'une fiche fournisseur, annulation d'un job de queue, mail entrant écarté, expiration / clôture d'une demande, annulation d'une commande.
- Ton par défaut pour les actions réversibles ou sans perte : relancer, rejouer, renvoyer, publier, révéler, réindexer, rattacher, réactiver…
- Annuler (bouton, Échap, voile) n'envoie aucune visite Inertia.

## Écrans migrés

- Composables admin : `use_queue_job_actions`, `use_mail_actions`, `use_inbound_mail_actions`, `use_admin_product_actions`, `use_admin_subscription_actions`, `use_admin_organization_actions`, `use_supplier_link_actions`. Ceux qui recevaient un texte de confirmation reçoivent désormais un `ConfirmOptions` (`message`, `confirmLabel`, `tone`) construit par l'appelant.
- Composants admin : actions produit et masquage, actions utilisateur, interventions sur une demande, modération des messages, réindexation de la recherche, reprise du stockage, jobs planifiés, rattachement fournisseur, sections organisation (membres, invitations, cycle de vie, abonnement).
- Pages admin : attributs, certifications, techniques de marquage, catégories ; attributs de catégorie et valeurs d'attribut.
- Organisation (membres, invitations, zone de danger), compte (zone de danger, passkeys), documents, commandes, campagnes publicitaires, contacts et produits du fournisseur.

## Traductions

- Nouvelle clé `admin.queue.actions.cancelJob` (« Annuler le job ») dans les 9 langues : le bouton de confirmation de l'annulation d'un job ne peut pas s'appeler « Annuler » comme le bouton de refus.

## Tests

- Les specs Vitest qui simulaient `window.confirm` (`vi.stubGlobal('confirm', …)`) montent l'hôte (`mountConfirmHost`) et répondent à la fenêtre (`answerConfirm`) : annuler n'envoie aucune visite, confirmer l'envoie ; le message et le ton `danger` sont vérifiés là où c'est pertinent.
