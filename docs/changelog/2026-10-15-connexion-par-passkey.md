# Connexion par passkey (WebAuthn)

> Date : 2026-10-15

Un utilisateur peut enregistrer une ou plusieurs passkeys (empreinte, visage, code
de l'appareil, clé de sécurité) et se connecter avec, **sans mot de passe ni saisie
d'email**. Le mot de passe reste disponible : la passkey est une alternative, pas un
remplacement.

- **Table `passkeys`** (migration avec `down()`) — `user_id` (cascade), `credential_id`
  (unique, base64url), `public_key` (COSE, base64url), `counter`, `transports`,
  `device_type`, `backed_up`, `name`, `last_used_at`. Modèle `Passkey`, factory
  `PasskeyFactory`.
- **Librairies** — `@simplewebauthn/server` (vérification) et `@simplewebauthn/browser`
  (cérémonie côté navigateur). Attestation `none`, identifiants **découvrables**
  (`residentKey: required`), `userVerification: preferred`.
- **Configuration** — `config/passkey.ts` : `rpID` et origine dérivés de `APP_URL`,
  surchargeables par `PASSKEY_RP_ID` / `PASSKEY_ORIGIN` (optionnelles). ⚠️ Le `rpID`
  lie les passkeys à un domaine : le changer les invalide toutes.
- **Enregistrement** (page « mon compte », routes authentifiées hors `emailVerified`)
  — `GET account/passkeys/options` (JSON, émet le défi), `POST account/passkeys`,
  `PATCH` / `DELETE account/passkeys/:id` (renommer, supprimer ; strictement limité aux
  passkeys du compte, 404 sinon). Nouvelle section `PasskeysSection` sur la page.
- **Connexion** (routes `guest`) — `GET passkeys/options` (JSON) puis
  `POST passkeys/login`. Bouton « Se connecter avec une passkey » sur `login.vue`
  (masqué si le navigateur ne supporte pas WebAuthn). Même destination qu'un login par
  mot de passe (`?redirect=` sûr, sinon onboarding / accueil) via `LoginRedirectService`,
  désormais partagé avec `SessionController`.
- **Sécurité** — défi stocké en **session**, à usage unique (retiré dès la première
  vérification, échouée ou non) et valable 5 min ; origine et `rpID` vérifiés ; compteur
  de signatures contrôlé (authentificateur cloné refusé) ; message d'échec unique et
  générique, sans indiquer si une passkey existe. Limiteur `passkey-login` : 20 / 15 min
  par IP.
- **RGPD** — la suppression du compte (anonymisation) supprime aussi ses passkeys.
- **Endpoints JSON** — seules les deux routes `options` répondent en JSON (en `GET`, sans
  effet de bord hors session) : le navigateur en a besoin pour parler à
  l'authentificateur. Le résultat repart par une mutation Inertia (`useForm`) et une
  redirection.
- **Tests** — `tests/functional/passkeys.spec.ts` (21) contre la vraie vérification
  WebAuthn grâce à `FakeAuthenticator` (`tests/utils/fake_authenticator.ts`),
  `tests/inertia/passkeys.spec.ts` (9).
