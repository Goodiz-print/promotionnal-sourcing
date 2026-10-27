# Retrait de `FilterableFacetsService`

> Date : 2026-10-27

Les facettes `attributes.<slug>` sont mappées dynamiquement par Elasticsearch (gabarit `attributes.*`) : plus aucune liste de slugs filtrables n'est à fournir au moteur. `FilterableFacetsService` (dérivation des slugs `category_attributes.is_filter`) n'avait plus d'appelant ; il est supprimé avec son test. La barre de filtres par catégorie (`CatalogueFacetBarService`) n'en dépendait pas et est inchangée.
