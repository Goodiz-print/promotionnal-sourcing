import aiConfig from '#config/ai'

/**
 * La recherche par image est-elle utilisable ? Fonction activée (`AI_VISION_ENABLED`)
 * et clé Mistral présente. Fonction pure, lue à chaque appel : les pages publiques
 * (catalogue) s'en servent sans dépendre du service ni du client Mistral.
 */
export function isImageSearchAvailable(): boolean {
  return aiConfig.vision.enabled && Boolean(aiConfig.mistral.apiKey)
}
