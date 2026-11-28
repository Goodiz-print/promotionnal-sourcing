# Sélecteur de pays avec recherche, partout

> Date : 2026-11-28

Les listes de pays étaient des `<select>` natifs de 250 entrées (ou des champs
texte où l'on tapait le code ISO à la main), dont la liste ouverte est dessinée
par le système : pas de recherche, pas de curseur « main » sur les choix. Tous
les champs pays passent par un nouveau composant **`CountrySelect`**.

- **`BaseCombobox`** (`inertia/components/base/base_combobox.vue`) : bouton qui
  ouvre un panneau avec un champ de recherche et les options filtrées, chaque
  choix en `cursor-pointer`. Recherche sans accents ni casse sur le libellé, ou
  par code exact (`filterOptions`, `shared/helpers/option_filter.ts`). Clavier :
  flèche bas pour ouvrir, flèches haut/bas, Entrée, Échap (rend le focus au
  bouton). `clearLabel` ajoute en tête une option qui émet `null` (« Tous les
  pays »). Une valeur absente des options s'affiche telle quelle (son code).
- **`CountrySelect`** (`inertia/components/country_select.vue`) : `BaseCombobox`
  alimenté par `useRegionOptions` (noms dans la langue de la page) ; `codes`
  restreint la liste aux pays présents en base (filtres).
- **`BaseTagPicker`** (pays et langues d'un contact fournisseur) ajoute ses
  valeurs via `BaseCombobox` ; nouvelles props `searchLabel` et `noResultsLabel`.
- **Écrans concernés** : inscription agence, paramètres de l'organisation
  (adresse), fiche organisation admin, filtres de la liste des organisations
  admin, pays d'origine d'un produit, annuaire des fournisseurs (les filtres
  affichent maintenant le nom du pays et non plus son code), contacts
  commerciaux du fournisseur. Les valeurs envoyées restent des codes ISO 3166-1
  alpha-2 : aucun changement côté serveur.
- **Traductions** : `common.country.{placeholder,search,noResults}` et
  `common.choices.{search,noResults}` dans les 9 langues.

Tests : `tests/unit/option_filter.spec.ts`, `tests/inertia/base_combobox.spec.ts`
(et specs des écrans adaptées via `tests/inertia/support/combobox.ts`).
