# Système d'événements (Emitter)

> Date : 2026-06-26

Configuration du système d'événements AdonisJS (`@adonisjs/core/services/emitter`) avec listeners lazy-loaded.

- **Fichiers ajoutés** :
  - `app/events/user_registered.ts` — event émis à l'inscription d'un utilisateur
  - `app/events/user_logged_in.ts` — event émis à la connexion d'un utilisateur
  - `app/listeners/on_user_registered.ts` — listener associé à `UserRegistered`
  - `app/listeners/on_user_logged_in.ts` — listener associé à `UserLoggedIn`
  - `start/events.ts` — enregistrement des bindings event → listener
- **`adonisrc.ts`** : ajout du preload `#start/events`
- **Comportement notable** :
  - Les listeners sont lazy-loaded (import dynamique) — aucun impact sur le démarrage
  - Pour émettre : `await emitter.emit(UserRegistered, new UserRegistered(user))`
  - Pour ajouter un event : classe dans `app/events/`, listener dans `app/listeners/`, binding dans `start/events.ts`
- **Doc** : [docs/emitter.md](./emitter.md)
