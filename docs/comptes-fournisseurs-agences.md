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
téléphone, langues, pays couverts, membre du compte relié — cf. « Équipe
commerciale » ci-dessous), `supplier_news` (image dans `STORAGE_REFERENCES`),
`supplier_trade_shows`, `organization_categories` (spécialités, pivot vers l'arbre
de catégories). Catalogue PDF et justificatifs de certification : `organization_documents`.

### Équipe commerciale (#241)

Chaque contact de `supplier_contacts` porte `countries` (codes ISO alpha-2,
liste vide = tous les pays) et, facultativement, `user_id` : le commercial est
alors aussi un membre du compte fournisseur. L'option
`supplier_profiles.show_all_contacts` (désactivée par défaut) montre toute
l'équipe à toutes les agences.

`SupplierContactService.visibleFor` est la **seule** règle d'affichage, évaluée
à la lecture : visiteur non connecté ou fournisseur non abonné
(`SubscriptionService.isSubscribed`) → aucun contact ; option activée → tous ;
sinon les contacts qui couvrent le pays de l'organisation courante du visiteur
(ou tous les pays) ; aucun → toute l'équipe (repli). Les contacts écartés ne sont
jamais envoyés au navigateur. Les demandes de devis partent toujours à l'adresse
de réception générale du fournisseur, pas au commercial.

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

## Inscription agence (`/:locale/signup/agency`)

Une seule étape, publique, sans carte bancaire : `AgencySignupController` →
`AgencySignupService#register`, en une transaction (utilisateur, organisation
`buyer` dont il est `owner`, `agency_profiles`, journal `legal_consents`).
Le mail de vérification d'adresse part comme à l'inscription simple.

**Activation automatique** quand tout concorde, sinon l'inscription aboutit et
l'équipe valide sous 24 h. Les motifs sont posés dans `organizations.review_reasons`
(vide = actif immédiatement) :

| Motif               | Déclencheur                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| `vat_unverified`    | VIES ne confirme pas le numéro (invalide, indisponible, pays hors UE)         |
| `free_email_domain` | adresse gmail, hotmail, orange… (liste dans `shared/helpers/email_domain.ts`) |
| `domain_mismatch`   | domaine de l'email ≠ site web (le sous-domaine est accepté)                   |
| `no_website`        | pas de site web renseigné                                                     |
| `other_activity`    | activité « Autre »                                                            |

- **TVA ou SIRET** : un SIRET (14 chiffres, Luhn) est conservé comme SIRET et
  contrôlé via le numéro de TVA français dérivé du SIREN. `vat_verified_at` et
  `domain_verified_at` tracent les contrôles réussis.
- **VIES** : `VatVerifier` (classe abstraite) liée à `ViesVatVerifier` dans
  `providers/vat_provider.ts` ; délai de 5 s, jamais d'exception (indisponible →
  validation manuelle). Faux de test : `tests/utils/fake_vat_verifier.ts`.
- **Langue** : proposée selon le pays (`defaultLocaleForCountry`), modifiable.
  Pays et langues sont affichés avec `Intl.DisplayNames`, sans table de traduction.
- **Consentements** : CGU et certification professionnelle obligatoires (version
  `CURRENT_LEGAL_VERSION`, IP, date) ; communications partenaires facultatives,
  jamais pré-cochées. La formulation de la certification reste à faire valider
  par l'avocat.

Non traité ici : écran de validation manuelle pour l'équipe (les motifs sont en
base mais aucune liste ni action « approuver »), blocage des fonctions tant que
le compte n'est pas validé, détection d'une entreprise déjà inscrite (même TVA).
