# Factories Lucid et socle de fixtures partagé (tests backend)

> Date : 2026-08-20

Second volet de la revue du système de test, après le passage Postgres-only.
Chaque spec réécrivait son propre `makeUser` / `makeMember` / `makeOrganization`
/ `join` : six variantes aux signatures divergentes, 46 hooks `group.setup`
recopiés, 7 specs réinstanciant les seeders de rôles à la main.

- **Factories** (`database/factories/`) — `UserFactory`, `OrganizationFactory`
  (états `supplier`, `both`, `archived`) et `OrganizationInvitationFactory`
  (états `accepted`, `revoked`, `expired`). `@adonisjs/lucid/factories` embarque
  `@faker-js/faker` : aucun paquet ajouté.
- **`useDatabase(group, options)`** (`tests/utils/setup.ts`) — un seul point
  d'entrée pour le cycle base de données d'un groupe : `truncate()` puis les
  seeders. `seed: 'none' | 'roles' | 'full'`, `extraSeeders`, `perTest`.
- **Helpers d'organisation** (`tests/utils/organizations.ts`) —
  `joinOrganization`, `createMember`, `createOrganizationWithOwner`,
  `createMemberOf` et `seededDevUser` (qui remplace trois copies de
  `devUserWithCurrentOrg`). `DevUserSeeder` exporte désormais `DEV_USER_EMAIL`,
  au lieu de laisser l'email du compte de démo en dur dans les specs.
- **Deux défauts corrigés au passage** : `joined_at` est maintenant toujours
  renseigné (plusieurs specs s'en remettaient au défaut de la base), et le mot
  de passe des utilisateurs de test est passé **en clair**. `User` compose
  `withAuthFinder`, dont le hook `beforeSave` hache le champ : les
  `hash.make()` des specs produisaient un **hash de hash** — sans effet avec
  `loginAs`, mais un `POST /login` avec ces comptes aurait échoué.
- **21 specs migrées** ; `tests/unit/example.spec.ts` (`2 + 2 === 4`) supprimé.
  Vérifié titre par titre contre `main` : **aucun test renommé, aucun test
  perdu** — 171 → 168, l'écart étant exactement les 3 tests d'exemple.
- **Doc** : `docs/tests.md` (§ `useDatabase`, § Factories et helpers) et règle
  ajoutée dans `CLAUDE.md` (pas de `Model.create` inline pour les entités socle,
  pas de helper de fixtures recopié dans une spec).
