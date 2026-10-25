# Modèle de données des comptes fournisseurs et agences

> Date : 2026-10-25

Le modèle suit désormais le classeur « Informations comptes fournisseurs /
agences » (détail et correspondance dans
[`docs/comptes-fournisseurs-agences.md`](../comptes-fournisseurs-agences.md)).

- `organizations` : `vat_verified_at`, `domain_verified_at`, `locale`,
  `subscription_plan` (free · business · premium), `banner_storage_object_id`.
- `users` : `civility`, `last_login_at`, et `full_name` remplacé par `first_name` /
  `last_name` (reprise des données : premier mot = prénom, reste = nom ; rollback
  complet). `User#fullName` devient un getter d'affichage. L'inscription exige
  prénom et nom ; « mon compte » les édite séparément.
- `supplier_profiles` : type d'entreprise, pays livrés, langues parlées, minimum
  de commande (texte), email des devis, fréquence du rapport, mode et fréquence de
  mise à jour du catalogue, plus le suivi commercial interne (statut, contact
  principal, partenaire fondateur, format reçu, notes) non exposé au fournisseur.
- Nouvelles tables : `agency_profiles`, `billing_profiles`, `legal_consents`
  (journal des signatures et consentements), `supplier_contacts`, `supplier_news`,
  `supplier_trade_shows`, `organization_categories`, `agency_favorite_suppliers`.
- `STORAGE_REFERENCES` couvre la bannière et l'image des actualités.
- Le moyen de paiement n'est jamais stocké (Stripe).
- Hors prénom/nom, aucun nouvel écran ni route : modèles, types partagés, factories
  et `tests/functional/account_profiles.spec.ts`.
