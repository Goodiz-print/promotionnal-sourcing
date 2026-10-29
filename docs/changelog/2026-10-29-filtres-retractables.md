# Catégories de filtres rétractables

> Date : 2026-10-29

Chaque groupe de la barre de filtres du catalogue (rapides, provenance, stock, prix, MOQ,
certifications, attributs de catégorie) se replie via son en-tête (titre + chevron
`ChevronDown`). Ouvert par défaut ; l'état est local au groupe. Le corps reste dans le DOM
(`v-show`) : les cases cochées sont conservées et les filtres actifs restent appliqués.

- `FacetSection` : bouton `aria-expanded` / `aria-controls`, prop `defaultOpen`.
- Aucun texte nouveau (pas de clé i18n).
