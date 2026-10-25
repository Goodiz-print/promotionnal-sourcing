# Transport Transmit partagé entre instances web (#57)

> Date : 2026-10-25

Les notifications temps réel n'atteignaient que les navigateurs connectés à l'instance web qui les créait. Avec deux instances en production (ADR 0003), la moitié des utilisateurs ne voyait rien arriver sans recharger.

- **`TRANSMIT_TRANSPORT`** (`memory` par défaut, `postgres`) : nouvelle variable, validée dans `start/env.ts` et documentée dans `.env.example`. À définir à `postgres` sur chaque instance web de staging et de production.
- **`PostgresTransport`** (`app/services/realtime/postgres_transport.ts`) : transport Transmit sur `LISTEN` / `NOTIFY`, choisi plutôt que Redis pour ne pas ajouter de brique à exploiter. Un canal PostgreSQL unique, le canal Transmit dans l'enveloppe, une instance qui ne se rejoue pas ses messages. Connexion d'écoute dédiée avec reconnexion à attente croissante (abonnements conservés), pool d'une connexion pour la publication, connexions ouvertes au premier usage seulement.
- **Dépendance** : `@boringnode/bus` ajouté en dépendance directe (déjà présent via Transmit, même version `0.9.0`) pour typer le transport.
- **Tests** : diffusion entre deux instances, pas d'écho, routage par canal, `unsubscribe`, message trop gros abandonné, reconnexion après coupure de la session d'écoute, transport en mémoire par défaut.
- **Limites** : charge de `NOTIFY` plafonnée à ~8 000 octets ; livraison au mieux (une instance coupée rate les messages émis pendant la coupure) ; pas de PgBouncer en mode transaction devant la base ; +2 connexions par instance web. Comportement sur Clever Cloud à valider en préproduction.
