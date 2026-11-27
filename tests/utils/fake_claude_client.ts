import type Anthropic from '@anthropic-ai/sdk'

/** Ce qu'un test décide de la réponse de Claude ; le reste prend une valeur neutre. */
export interface FakeClaudeReply {
  text?: string
  stopReason?: Anthropic.Message['stop_reason']
  /** Blocs placés avant le texte (ex. un bloc `thinking`). */
  leadingBlocks?: Array<{ type: string }>
  inputTokens?: number
  outputTokens?: number
}

function messageFor(reply: FakeClaudeReply) {
  return {
    content: [
      ...(reply.leadingBlocks ?? []),
      ...(reply.text === undefined ? [] : [{ type: 'text', text: reply.text }]),
    ],
    stop_reason: reply.stopReason ?? 'end_turn',
    usage: { input_tokens: reply.inputTokens ?? 0, output_tokens: reply.outputTokens ?? 0 },
  }
}

/**
 * Faux client Anthropic : aucun appel réseau. `messages.create` et
 * `messages.stream(...).finalMessage()` rendent `reply` (ou lèvent si c'est une
 * erreur), `models.list` se résout ou lève `modelsError`. Chaque requête de
 * message est conservée dans `requests`.
 */
export function fakeClaudeClient(
  reply: FakeClaudeReply | Error = {},
  options: { modelsError?: Error } = {}
) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = []
  const answer = async (request: Anthropic.MessageCreateParamsNonStreaming) => {
    requests.push(request)
    if (reply instanceof Error) throw reply
    return messageFor(reply)
  }
  const client = {
    messages: {
      create: answer,
      stream: (request: Anthropic.MessageCreateParamsNonStreaming) => ({
        finalMessage: () => answer(request),
      }),
    },
    models: {
      async list() {
        if (options.modelsError) throw options.modelsError
        return { data: [] }
      },
    },
  } as unknown as Anthropic
  return { client, requests }
}
