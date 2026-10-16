# Activation du SSR (Server-Side Rendering)

> Date : 2026-06-27

Activation du rendu côté serveur via Inertia.js + Vue 3 SSR pour améliorer le SEO et les performances de la marketplace.

- **`config/inertia.ts`** : `ssr.enabled` passé à `true`
- **`vite.config.ts`** : `ssr.enabled` passé à `true` dans le plugin Inertia
- **`inertia/app.ts`** : `createApp` remplacé par `createSSRApp` pour l'hydratation côté client
- **`inertia/ssr.ts`** : déjà configuré correctement (`createSSRApp` + `renderToString`)
- **Build SSR** : `node ace build` génère le bundle SSR ; en dev `node ace serve --hmr` supporte le SSR à chaud
- **À surveiller** : tout accès à `window` / `document` doit être dans `onMounted` ou un guard `typeof window !== 'undefined'`
