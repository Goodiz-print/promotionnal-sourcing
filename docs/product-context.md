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

Les agences utilisent la plateforme gratuitement. Les fournisseurs ont trois
formules : **Gratuit**, **Business** (250 € HT / mois) et **Premium**
(500 € HT / mois). L'abonnement est aujourd'hui activé à la main par l'équipe
(formule, premier et dernier jour, retour automatique en gratuit) ; la
souscription en ligne existe aussi. Détail : [`abonnements.md`](abonnements.md).

## Parcours devis

Le parcours principal passe par le mail (#234, détail dans
[`rfq.md`](rfq.md#parcours-devis-par-mail-234)) :

1. L'agence ajoute des produits à son panier (variante, marquage, quantités) et
   valide ; tout membre de l'agence peut envoyer. Une demande part à chaque
   fournisseur et reste visible de toute l'agence dans « Mes demandes ».
2. Le fournisseur reçoit par mail toutes les informations, prix indicatifs du
   site compris, à son adresse de réception des demandes.
3. Il répond depuis sa messagerie en joignant le PDF de son propre logiciel,
   sans se connecter. La plateforme enregistre la réponse et la transmet à
   l'agence par mail.
4. Chacun garde une trace : « Mes demandes » côté agence (l'agence retient un
   devis, la suite se fait hors plateforme), « Demandes reçues » côté
   fournisseur (à traiter, répondu, expiré).

Seuls les fournisseurs qui ont donné leur accord ont leurs produits sur le
site : ils ont alors un compte, auquel l'équipe rattache leur catalogue
importé (#231, #240).

### Rôle de l'abonnement

Il change ce que le fournisseur sait de l'agence, pas ce qu'il reçoit :

- **Gratuit** : la demande est **anonyme** et le fournisseur n'échange avec
  l'agence que par les mails de la plateforme. Son devis PDF est transmis à
  l'agence avec un bandeau qui porte le nom de celle-ci. Il voit combien de fois
  ses produits ont été consultés, sans savoir par qui.
- **Business / Premium** : il voit le nom et les coordonnées de l'agence (même
  sur les demandes reçues avant de s'abonner) et peut la contacter en direct ;
  il voit quelles agences ont consulté ses produits ; son équipe commerciale
  est affichée aux agences.

Tableau complet : [`abonnements.md`](abonnements.md#ce-que-labonnement-change-dans-le-parcours-devis).

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
