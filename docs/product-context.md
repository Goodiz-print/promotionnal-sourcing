# Contexte produit — Promotional Sourcing.eu

## Pitch

**Promotional Sourcing.eu** est une plateforme B2B européenne de sourcing d'objets publicitaires.

### Le problème

Le marché des goodies est fragmenté. Les revendeurs perdent un temps fou à chercher le bon produit parmi des centaines de fournisseurs.

Exemple concret : un client demande un sac shopping Made in Europe, grammage +200g/m². Impossible de savoir quel fournisseur l'a sans feuilleter 100 catalogues.

### La solution

Une plateforme unique qui agrège 300 fournisseurs européens et plus d'un million de produits. Recherche intelligente, comparaison instantanée, demande de devis en un clic.

### Le modèle économique

Gratuit dans sa version light, réservé aux professionnels (fournisseurs et revendeurs).

### Objectif

Devenir le réflexe #1 des acheteurs européens d'objets publicitaires.

## Positionnement concurrentiel

Face au concurrent principal (**European Sourcing**), nos avantages :

- Interface moderne
- Recherche qui fonctionne vraiment
- Intégration IA pour recherche par image
- Pas d'abonnement obligatoire

## Problème central chez les concurrents (à ne pas reproduire)

Le principal défaut des solutions concurrentes est qu'elles ne remplissent pas leur mission première : le sourcing. Dès qu'une recherche combine 2 ou 3 critères, le moteur de recherche devient inutilisable.

**Exemple** : chercher un _stylo à encre noire, Made in Europe_ — une recherche simple en apparence, mais qui échoue chez les concurrents dès que plusieurs critères sont combinés.

**Conséquence pour la conception** : le moteur de recherche/filtres de Promotional Sourcing doit être conçu dès le départ pour supporter la combinaison fiable de plusieurs critères simultanés (ET logique). C'est le point de différenciation le plus critique du produit — pas un détail d'implémentation secondaire.

## Critères de recherche clés (à formaliser plus tard)

Liste de départ, non figée, à formaliser plus tard dans `shared/types/` (ex. futurs `product.ts`, `supplier.ts`) lors de la modélisation du domaine produit/sourcing :

- Origine / provenance (ex. Made in Europe)
- Matière / composition
- Grammage (g/m²) — pertinent pour textile/papier
- Couleur
- Catégorie de produit (stylos, sacs, textile...)
- Fournisseur (parmi les ~300 agrégés)
- Combinaison de plusieurs critères simultanément — l'enjeu technique central
- Recherche par image (IA)
