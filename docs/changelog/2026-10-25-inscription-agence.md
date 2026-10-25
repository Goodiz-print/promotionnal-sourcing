# Inscription agence

> Date : 2026-10-25

Nouveau formulaire public `GET/POST /:locale/signup/agency` (lien depuis
l'inscription simple) : l'agence crée son compte utilisateur et son organisation
acheteur en une étape, sans carte bancaire ni appel commercial.

- Champs : civilité (facultative), prénom, nom, email professionnel, mot de passe
  (10 caractères minimum), raison sociale, pays (liste ISO complète), TVA ou SIRET,
  site web et téléphone (facultatifs), activité (+ précision si « Autre »), langue
  (déduite du pays), certification professionnelle, CGU, communications partenaires.
- Activation immédiate si VIES confirme la TVA (ou le SIRET), si l'email est au
  domaine du site et si l'activité n'est pas « Autre » ; sinon validation manuelle,
  motifs dans `organizations.review_reasons`.
- Consentements horodatés dans `legal_consents` (version, IP).
- `OrganizationService#create` accepte une transaction et des colonnes initiales.
- Textes en 9 langues (`agency_signup.json`), messages de validation `regex`,
  `accepted` et `url` ajoutés.
- Tests : helpers (`tax_id_and_email_domain`), inscription (`agency_signup`,
  faux VIES), formulaire (`signup_agency`).
