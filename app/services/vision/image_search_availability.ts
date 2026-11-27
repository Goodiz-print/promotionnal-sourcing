import aiConfig from '#config/ai'
import { llmApiKey } from '#shared/helpers/llm'

/**
 * La recherche par image est-elle utilisable ? Fonction activée (`AI_VISION_ENABLED`)
 * et clé du fournisseur actif (`AI_LLM_PROVIDER`) présente. Lue à chaque appel : les
 * pages publiques (catalogue) s'en servent sans dépendre du service ni du client IA.
 */
export function isImageSearchAvailable(): boolean {
  return aiConfig.vision.enabled && Boolean(llmApiKey(aiConfig))
}
