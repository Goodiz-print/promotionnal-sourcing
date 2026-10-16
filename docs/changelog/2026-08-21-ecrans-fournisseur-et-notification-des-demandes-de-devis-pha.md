# Écrans fournisseur et notification des demandes de devis — Phase 3, PR 3/3 (#4)

> Date : 2026-08-21

La boucle RFQ est complète : ce que l'acheteur envoie, le fournisseur le reçoit,
le consulte et peut le décliner. Clôt l'issue #4.

- **Deux écrans fournisseur** — `supplier/rfqs/index.vue` (demandes reçues,
  acheteur, échéance, avancement en pastille) et `supplier/rfqs/show.vue` (le
  besoin, l'action « décliner »). Routes `supplier.rfqs.{index,show,decline}`,
  gardées par `canRespondToRfq`.
- **Ouvrir le détail vaut accusé de lecture** : `sent` → `viewed` à l'affichage,
  sans clic. L'acheteur voit l'avancement dans sa liste de destinataires. La
  bascule n'est jamais régressive (une demande déclinée ou chiffrée le reste).
- **Notification par mail à l'envoi** — nouveau `kind` `rfq-received` de
  `SendMailJob` (`RfqReceivedNotification` + `emails/rfq_received.edge`), mis en
  queue par `RfqNotificationService`. Un mail par destinataire, **uniquement**
  pour les lignes que `send` vient de basculer : élargir une demande déjà
  publiée ne relance personne.
- **Qui est prévenu** : l'adresse de contact de l'organisation fournisseuse
  quand elle est renseignée ; à défaut, ses membres `owner`/`admin`/`manager` —
  les seuls à avoir accès à l'écran de réponse (`RFQ_RESPONDER_ROLES`, partagé
  avec l'ability `canRespondToRfq`).
- **Le budget plafond de l'acheteur ne part pas chez les fournisseurs** :
  `SupplierRfqType` ne le porte pas, pas plus que la liste des autres
  destinataires — un fournisseur consulté ignore qui d'autre l'est.
- **Un échec de mise en queue ne casse pas l'envoi** : il est loggué en
  `warn`, les statuts restent basculés et la demande apparaît de toute façon
  dans l'écran du fournisseur. Le mail est un rappel, pas le canal.
- **`rfq_item_list.vue`** — les lignes du besoin en lecture seule, partagées
  entre l'écran acheteur (demande publiée) et l'écran fournisseur, au lieu du
  bloc dupliqué.
- **Tests** — `tests/functional/supplier_rfqs.spec.ts` (9), deux tests d'envoi
  de mail dans `rfq_screens.spec.ts`, un test de reconstruction du nouveau
  `kind` dans `tests/unit/send_mail_job.spec.ts`, et
  `tests/inertia/supplier_rfqs.spec.ts` (7). Suite backend : 210 tests.
