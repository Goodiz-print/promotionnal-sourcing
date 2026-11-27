import env from '#start/env'
import { DEFAULT_LLM_PROVIDER, type LlmModels, type LlmProvider } from '#shared/types/ai'

/**
 * Fournisseur du modèle de langage (traduction + description d'image) :
 * `AI_LLM_PROVIDER`, Mistral par défaut. Un seul choix pour les deux fonctions
 * (ADR 0006). Les embeddings n'en dépendent pas : voir `config/search.ts`
 * (`AI_PROVIDER`) et l'ADR 0002 — Claude n'a pas d'API d'embeddings.
 */
const provider: LlmProvider = env.get('AI_LLM_PROVIDER', DEFAULT_LLM_PROVIDER)

const MODELS: Record<LlmProvider, LlmModels> = {
  mistral: {
    translation: env.get('MISTRAL_TRANSLATION_MODEL', 'mistral-small-latest'),
    vision: env.get('MISTRAL_VISION_MODEL', 'pixtral-12b-latest'),
    // Quelques mots-clés suffisent : réponse courte.
    visionMaxTokens: 200,
  },
  claude: {
    translation: env.get('CLAUDE_TRANSLATION_MODEL', 'claude-haiku-5-5'),
    vision: env.get('CLAUDE_VISION_MODEL', 'claude-haiku-5-5'),
    // La réflexion du modèle compte dans le plafond : il faut de la marge au-delà
    // des quelques mots-clés, sinon la réponse est coupée avant le texte.
    visionMaxTokens: 2000,
  },
}

/**
 * Configuration IA : traduction automatique et recherche par image. Les
 * embeddings ne sont plus calculés par l'application : Meilisearch les calcule
 * lui-même, voir `config/search.ts` (`embedder`) et l'ADR 0002.
 */
const aiConfig = {
  provider,

  mistral: {
    apiKey: env.get('MISTRAL_API_KEY'),
  },

  claude: {
    apiKey: env.get('ANTHROPIC_API_KEY'),
  },

  /**
   * Traduction automatique. `model` (celui du fournisseur actif) et
   * `promptVersion` entrent dans la clé d'idempotence : changer de fournisseur ou
   * de modèle, ou bumper la version du prompt, force la retraduction.
   */
  translation: {
    enabled: env.get('AI_TRANSLATION_ENABLED', false),
    model: MODELS[provider].translation,
    promptVersion: 1,
    // Plafond de sortie d'un appel : les 31 langues cibles d'une fiche tiennent dans
    // un seul appel (#97). Une réponse tronquée est rejetée.
    maxTokens: 30_000,
  },

  /**
   * Tarif par million de tokens du modèle de traduction actif, pour estimer le coût
   * affiché dans le back-office (#177). Il ne s'applique qu'aux appels faits avec ce
   * modèle : après un changement de fournisseur, les anciens appels ne sont pas chiffrés. Aucun tarif par défaut : ils changent, et un
   * coût inventé induirait en erreur. Sans tarif, seuls les tokens sont affichés.
   */
  pricing: {
    inputPerMillion: env.get('AI_PRICE_INPUT_PER_MILLION'),
    outputPerMillion: env.get('AI_PRICE_OUTPUT_PER_MILLION'),
    currency: env.get('AI_PRICE_CURRENCY', 'EUR'),
  },

  /**
   * Recherche par image : un modèle vision décrit la photo en mots-clés, puis la
   * recherche hybride du catalogue prend le relais. Désactivée par défaut ; sans
   * clé du fournisseur actif elle reste indisponible.
   */
  vision: {
    enabled: env.get('AI_VISION_ENABLED', false),
    model: MODELS[provider].vision,
    maxTokens: MODELS[provider].visionMaxTokens,
    // Appel fait pendant une requête HTTP : un fournisseur muet ne doit pas la figer.
    // Appliqué par le driver Claude (délai court, aucun réessai).
    timeoutMs: 20_000,
  },
}

export default aiConfig
