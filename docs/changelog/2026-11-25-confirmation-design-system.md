# Confirmations du parcours devis : fenêtre du design system

> Date : 2026-11-25

Les actions irréversibles du parcours devis ne passent plus par la boîte native du navigateur (`window.confirm`), hors design system et non traduite dans ses boutons (#291).

## Composants

- `inertia/components/base/base_confirm_dialog.vue` (`BaseConfirmDialog`) : fenêtre modale générique sur `<dialog>` natif (`showModal` : focus piégé, fond inerte), `role="alertdialog"`. Props `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `tone` (`default` · `danger`) ; émet `confirm` / `cancel`. Échap et clic sur le voile valent « Annuler ». En `danger`, bouton de confirmation `danger` et focus initial sur « Annuler » ; sinon bouton primaire, focus sur « Confirmer ».
- `inertia/composables/use_confirm.ts` : `useConfirm().confirm(options)` renvoie une `Promise<boolean>` ; une seule demande à la fois (une nouvelle annule la précédente). `useConfirmHost()` sert l'hôte.
- `inertia/components/app/confirm_dialog_host.vue` (`ConfirmDialogHost`), posé dans les layouts `default` et `auth` : rend la demande en cours, libellés génériques `common.confirmDialog.{title,confirm,cancel}` quand l'appelant n'en fournit pas ; une navigation annule la demande.
- Types `ConfirmOptions` / `ConfirmTone` dans `inertia/types/ui.ts`.

## Écrans migrés

- « Retenir » un devis PDF (`rfq_quote_documents.vue`) : titre « Retenir ce devis ? » (nouvelle clé `quote.documents.confirmSelectTitle`), bouton « Retenir ».
- Supprimer / clôturer une demande (`rfq_actions.vue`, `danger`).
- Remettre / supprimer un devis (`quote_form.vue`, suppression en `danger`).
- Accepter / rejeter un devis (`pages/quotes/show.vue`, rejet en `danger`).
- Décliner une demande reçue (`pages/supplier/rfqs/show.vue`, `danger`).

Le bouton de confirmation reprend le libellé de l'action. Nouvelles clés dans les 9 langues.

Les autres écrans sont migrés à leur tour : voir `2026-11-25-confirmations-partout.md`.

## Tests

- `tests/inertia/confirm_dialog.spec.ts` : composant (ouverture, boutons, Échap, voile, tonalité, focus), composable (accepter, annuler, demande remplacée) et hôte (libellés génériques, navigation).
- `tests/inertia/support/confirm_dialog.ts` (`mountConfirmHost`, `answerConfirm`) pour les specs d'écran : `rfq_my_requests`, `rfqs`, `quotes`, `supplier_rfqs` vérifient qu'annuler n'envoie aucune visite et que confirmer l'envoie.
