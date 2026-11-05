# Consentements légaux (administration)

> Date : 2026-11-05

Issue #168 : la plateforme consulte le journal `legal_consents` et exporte la preuve d'une organisation.

## Écrans et routes (droit `audit.view`, admin seul)

Le journal contient des données personnelles (adresse IP, email du signataire) : l'accès est réservé au droit `audit.view`, la matrice des rôles n'est pas modifiée.

- `GET /:locale/admin/consents` (`admin.consents.index`, `ConsentController`) : liste paginée (50), plus récent d'abord. Filtres : organisation (partiel), email du signataire (partiel), type, version exacte, « version dépassée uniquement ». Le compteur indique combien de consentements **actifs** (non retirés) sont signés sur une version **antérieure** à `CURRENT_LEGAL_VERSION` (comparaison de dates ISO ; une version plus récente n'est pas « dépassée »).
- `GET /:locale/admin/consents/export?organizationId=` (`admin.consents.export`) : CSV (`;`, UTF-8 avec BOM) de tous les consentements de l'organisation, le plus ancien d'abord : identifiant, type, version, date de signature, date de retrait, IP, email du signataire. Les cellules qui commencent par `=`, `+`, `-`, `@` sont neutralisées. Organisation inconnue : 404.
- Chaque export écrit une entrée d'audit `consent.exported` (cible `organization`, nombre de lignes) **dans la même transaction que la lecture**.
- Onglet « Consentements » dans la navigation admin, et section « Consentements » sur la fiche organisation (voir la liste filtrée, exporter la preuve) pour qui a le droit `audit.view`.
- Migration `1794000000003_alter_legal_consents_add_indexes.ts` : index sur `accepted_at` et `version` (tri et filtre de l'écran).

Lecture seule : aucune modification ni suppression de preuve n'est possible depuis l'interface.

## Audit des parcours qui écrivent un consentement

| Parcours                                   | Écrit `legal_consents` ?                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Inscription agence (`AgencySignupService`) | Oui : `terms`, `professional_certification` (+ `partner_communications` si coché)                                      |
| Inscription / onboarding fournisseur       | **Non** : `data_license` et `supplier_marketing` sont déclarés dans `LEGAL_CONSENT_KINDS` mais aucun code ne les écrit |

Les écrans ne montreront donc aucun consentement fournisseur tant que ce parcours n'est pas branché.

## Non couvert

- **Re-acceptation forcée** lors d'un changement de version : il n'existe pas d'écran de consentement côté utilisateur. L'écran admin repère déjà les consentements sur une version dépassée ; le blocage à la connexion reste à construire.
- **Gestion des versions depuis l'interface** : la version courante reste la constante `CURRENT_LEGAL_VERSION` (`shared/types/legal.ts`).
- **Export PDF** : CSV uniquement.
- Le cadre légal/RGPD de l'accès admin à ces données reste à valider.

Tests : `tests/functional/admin_consents.spec.ts`, `tests/inertia/admin_consents.spec.ts`.
