# Comptes fournisseurs et agences — modèle de données

Traduction en base du classeur « Informations comptes fournisseurs / agences »
(Virgile, 19 octobre 2026). Une agence est une organisation `buyer`, un
fournisseur une organisation `supplier` (voir [`organisations.md`](organisations.md)).
Cette étape couvre le **modèle** (migrations, modèles, types, factories) ; les
formulaires d'inscription, d'activation et de page fournisseur viennent ensuite.

## Correspondance classeur → base

| Information du classeur                                                           | Colonne / table                                                         |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Raison sociale, pays, site web, téléphone (standard), adresse du siège, logo      | `organizations` (existant)                                              |
| Numéro de TVA / SIRET                                                             | `organizations.vat_number` / `siret` (existant)                         |
| Vérification VIES automatique                                                     | `organizations.vat_verified_at`                                         |
| Email au domaine du site = validation auto                                        | `organizations.domain_verified_at`                                      |
| Langue de travail / langue                                                        | `organizations.locale` (défaut `fr`)                                    |
| Niveau d'abonnement (gratuit · Business · Premium)                                | `organizations.subscription_plan`                                       |
| Visuel de bannière                                                                | `organizations.banner_storage_object_id` (Cellar)                       |
| Civilité (facultative)                                                            | `users.civility`                                                        |
| Dernière connexion                                                                | `users.last_login_at` (date d'inscription = `created_at`)               |
| Adresse / email de facturation, référence de commande                             | `billing_profiles` (1 par organisation)                                 |
| Moyen de paiement                                                                 | **Jamais stocké** — Stripe ; seul `billing_profiles.stripe_customer_id` |
| CGU, licence de données, marketing, certification pro, communications partenaires | `legal_consents` (journal : type, version, IP, date, retrait)           |
| Utilisateurs supplémentaires / collaborateurs invités                             | `organization_users` + invitations (existant)                           |

### Fournisseur

`supplier_profiles` (existant) gagne :

- **Saisi par le fournisseur** : `company_type`, `delivery_countries` (si périmètre
  « pays choisis »), `spoken_languages`, `min_order_note` (texte libre type
  « 50 pièces ou 150 € HT »), `quote_email`, `report_frequency`,
  `catalogue_update_mode`, `catalogue_update_frequency`. Existants réutilisés :
  `bio` (« Notre histoire »), `certifications`, `delivery_scope`, `min_order_quantity`.
- **Suivi commercial interne** (jamais exposé : absent de `SupplierProfileType`
  et du validateur) : `commercial_status`, `primary_contact_name/email`,
  `is_founding_partner` + `founding_partner_until`, `catalogue_source_format`,
  `internal_notes`.

Nouvelles tables de la page publique : `supplier_contacts` (nom, fonction, email,
téléphone, langues, zone), `supplier_news` (image dans `STORAGE_REFERENCES`),
`supplier_trade_shows`, `organization_categories` (spécialités, pivot vers l'arbre
de catégories). Catalogue PDF et justificatifs de certification : `organization_documents`.

### Agence

`agency_profiles` (1 par organisation) : `activity` (+ `activity_other`),
`team_size`, `purchase_volume`, `client_sectors`, `default_margin_percent`.
`agency_favorite_suppliers` : fournisseurs favoris (pivot vers `suppliers`).

## Valeurs énumérées

Toutes les listes vivent dans `shared/types/{organization,agency,legal}.ts`
(const + union), réutilisées par les migrations (enum SQL) et les validateurs.

## Points ouverts

- **Tranches de volume d'achat** : le classeur ne donne que « 100-500 k€ » en
  exemple ; `AGENCY_PURCHASE_VOLUMES` propose 5 tranches à confirmer.
- **Prénom / nom** : `users.full_name` est remplacé par `first_name` / `last_name`
  (migration avec reprise des données : premier mot = prénom, reste = nom).
  `User#fullName` reste disponible en getter pour l'affichage.
- **Événements d'usage** (recherches, fiches vues, devis envoyés, pour les
  statistiques fournisseurs) : non modélisés ici, à traiter avec la politique de
  confidentialité.
- **Limites par formule** (3 utilisateurs en gratuit, illimité en Premium) :
  règle métier, pas de colonne.
- **Présentation traduite automatiquement** : `bio` reste monolingue pour l'instant.
