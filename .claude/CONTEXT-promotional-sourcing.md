# Promotional Sourcing — contexte projet

Plateforme : https://promotional-sourcing.eu/ — Repo landing : `Goodiz-print/PromotionnalSourcing-landing`
Dernière mise à jour : 2026-10-14 (notes de réunion de cadrage)

## Ce qu'est le produit

Marketplace B2B d'objets promotionnels. Deux populations :

- **Agences / clients** : cherchent, sélectionnent, demandent des devis.
- **Fournisseurs** : exposent leur catalogue, reçoivent les devis.

Objectif n°1 : **la recherche produit** est le cœur de l'outil. Toute décision produit se juge d'abord à l'aune de la qualité de la recherche.

Horizon long terme : **centrale d'achat** (nécessite stocks et tarifs fiables) puis **CRM** intégré à l'outil.

## Règles et décisions fixées

### Architecture / sécurité

- **Deux back-offices distincts** : un pour les agences/clients, un pour les fournisseurs. Ne jamais mutualiser.
- L'inscription client est **filtrée** : on contrôle qui peut devenir client (validation, pas d'inscription libre).

### Intégrations fournisseurs — deux familles à dissocier dans le modèle de données

| Mode    | Données                                | Écriture par le fournisseur                                     |
| ------- | -------------------------------------- | --------------------------------------------------------------- |
| **API** | produits, tarifs, **stocks**           | oui — le fournisseur peut ajouter/modifier ses produits via API |
| **CSV** | **tarifs uniquement** (on s'arrête là) | non                                                             |

Un fournisseur a un mode d'intégration ; les fonctionnalités dépendantes du stock (centrale d'achat) ne concernent que les fournisseurs API.

### Modèle économique

**Agences / clients — gratuit**, options payantes possibles sur :

- accès à la plateforme
- devis
- sélections de produits
- génération de fiches techniques
- recherche IA (coût à chiffrer avant de fixer un prix)

**Fournisseurs**

- présentation sur la plateforme : gratuite
- accès aux devis : **payant**
- analytique : forte attente — données de consultation de leurs produits (ex. « tel utilisateur a consulté ce produit pendant 20 min »). C'est un gros chantier, prévoir le tracking dès le départ.

**Publicité** : système interne type Google Ads (mise en avant payante) avec **prévisualisation des pubs** avant publication.

### Données produits

- Reformater toutes les données produits pour les optimiser, avec une **langue cohérente** par fiche.
- IA pour générer des **images supplémentaires**.
- Rubrique « **Produit disparu ?** » pour les produits retirés du catalogue.
- Produits **combinables / 100 % sur mesure** : configurateur (couleur gourde, capuchon, logo…). Les couleurs choisies doivent correspondre aux **filtres de couleur généraux**.

### Recherche et filtres

- Pays d'origine : **regroupés par zones du monde**.
- Grammage : **plages (ranges)**, pas de valeurs uniques.
- **Multi-sélection** sur tous les filtres.
- Filtres **adaptatifs** selon les produits recherchés.
- Couleurs = filtre transversal.
- **Agent IA de recherche** : demande _pourquoi_ l'utilisateur cherche, génère les filtres et lance la recherche. Exemple : « soirée étudiante » → clés USB + filtres adaptés.

### Catalogues et documents générés

- **Catalogues** à partir d'une sélection : page publique partageable + PDF.
- **Fiches techniques** (côté client).
- **Espace Plus (Esp +)** : base design + génération de plaquettes à envoyer au client final.

### Langues

Maximum de langues européennes ; ajouter celles qui manquent. Lié au reformatage des données.

## Point d'alerte infra

- `partners@promotional-sourcing.eu` arrive systématiquement en spam.
- DNS géré chez **Netlify** (pas OVH). Au 2026-08-26 : MX et DKIM présents, **SPF et DMARC manquants** → à ajouter dans Netlify.
- Mail : Google Workspace (partners@, contact@).

## Questions ouvertes (ne pas trancher seul)

- Tarification de la recherche IA.
- Critères exacts de validation d'un compte client.
- Périmètre et accès de l'Espace Plus (payant ?).
- « Produit disparu ? » : signalement utilisateur ou détection automatique ?
- Périmètre du CRM (clients seuls ou fournisseurs aussi).
- La note « BUT utilm la recherche » a été lue comme « objectif : utiliser la recherche » — à confirmer.

## Comment travailler sur ce projet

- Répondre en français.
- Quand une feature touche aux fournisseurs, toujours préciser si elle s'applique aux fournisseurs API, CSV, ou les deux.
- Quand une feature touche aux données produits, vérifier l'impact sur les filtres et sur les langues.
- Ne pas supposer de fonctionnalité stock pour les fournisseurs CSV.
