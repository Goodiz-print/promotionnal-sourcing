# Embeddings multi-provider (abstraction IA)

> Date : 2026-07-11

Rend la recherche sémantique **provider-agnostique** : le driver d'embeddings
est choisi par `AI_PROVIDER`, Mistral n'étant plus qu'un driver parmi d'autres.

- **Abstraction** : interface `EmbeddingProvider` (`shared/types/ai.ts`) +
  factory `app/services/embeddings/provider_factory.ts` (résout selon
  `AI_PROVIDER`). Exceptions `app/exceptions/ai_errors.ts`
  (`UnknownAiProviderError`, `EmbeddingProviderError`, `EmbeddingDimensionError`).
- **Drivers** : `mistral_provider.ts` (SDK natif, `outputDimension`) et
  `openai_compatible_provider.ts` (générique HTTP `/embeddings`, `fetch` injecté)
  couvrant OpenAI, Together, Groq, Ollama, vLLM, LM Studio… via `AI_BASE_URL` /
  `AI_API_KEY` / `AI_EMBED_MODEL`.
- **`EmbeddingService`** délègue désormais au provider injecté et **valide la
  dimension** (figée à 1024 = colonne `products.embedding`) → un provider ne
  sachant pas produire 1024 dims est rejeté explicitement.
- **Config/env** : `config/ai.ts` (provider + config par driver), env
  `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_EMBED_MODEL`,
  `MISTRAL_EMBED_MODEL` (toutes optionnelles). `.env.example` documenté.
- **Tests** : `tests/unit/embedding_service.spec.ts` étendu (service + fake
  provider, driver Mistral mocké, driver OpenAI-compatible avec `fetch` mocké,
  factory) — zéro appel réseau. Docs `catalogue.md`.
