# Specs RFQ : factories et mail isolé (phase 3)

> Date : 2026-10-15

- **Factories RFQ** : `RfqFactory` (états `published`), `RfqItemFactory`,
  `RfqSupplierFactory` (état `sent`) dans `database/factories/`. Les specs
  `rfq_screens` et `supplier_rfqs` n'utilisent plus de `Rfq.create` /
  `RfqItem.create` / `RfqSupplier.create` inline (règle CLAUDE.md).
- **Mail isolé** : le test « publier puis envoyer » de `rfq_screens.spec.ts`
  passe sous `mail.fake()` — `send` met un mail en queue et, en
  `QUEUE_DRIVER=sync`, il partirait sinon réellement vers SMTP.
- Écarté : figer l'horloge dans les specs d'invitation (marges de ±1 à 7 jours,
  aucun flake plausible).
