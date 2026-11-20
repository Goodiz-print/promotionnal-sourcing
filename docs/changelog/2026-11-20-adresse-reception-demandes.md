# Adresse de réception des demandes de devis

> Date : 2026-11-20

Issue #217. Les demandes de devis partent désormais à l'adresse que le
fournisseur a choisie pour les recevoir.

- **Règle unique** (`resolveQuoteAddresses`, `shared/helpers/quote_address.ts`) :
  `supplier_profiles.quote_email` → `organizations.email` → membres responsables
  (`owner`, `admin`, `manager`). Une adresse vide compte comme absente. Utilisée
  par `RfqNotificationService` pour le mail de demande et la relance.
- **Profil fournisseur** (`/supplier/profile`) : nouveau bloc « Réception des
  demandes de devis » avec le champ `quoteEmail` (`BaseInput` de type e-mail).
  Laissé vide, il enregistre `null`. La colonne et la validation existaient déjà.
- **Back-office** (`/admin/organizations`) : badge « Sans adresse de réception »
  sur les fournisseurs qui se rabattent sur leurs membres responsables, filtre
  `missingQuoteAddress=true` et champ `quoteAddressSource` (`quote_email`,
  `organization_email`, `members`, `null` hors fournisseur) dans les lignes et
  la fiche. La fiche affiche aussi l'adresse de réception du profil.
- **Mails entrants** : un mail envoyé depuis l'adresse de réception compte comme
  expéditeur connu (`inbound_mails.sender_known`).
- Traductions dans les 9 langues (`supplier.json`, `admin.json`).
- Tests : `tests/unit/quote_address.spec.ts` (un test par niveau),
  `rfq_mail_locale.spec.ts`, `admin_organizations.spec.ts`, `inbound_mail.spec.ts`,
  et les specs Vitest du profil et de la liste admin.
