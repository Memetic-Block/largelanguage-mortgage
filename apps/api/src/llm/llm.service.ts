export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { parseSSEStream } from './sse-stream.util'

@Injectable()
export class LlmService {
  private readonly litellmUrl: string
  private readonly logger = new Logger(LlmService.name)

  constructor(private config: ConfigService) {
    this.litellmUrl = config.getOrThrow('LITELLM_URL')
  }

  async *streamChat(
    messages: ChatMessage[],
    model = 'mortgage-advisor',
    apiKey?: string,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${this.litellmUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
    })

    if (!response.ok) {
      const body = await response.text()
      this.logger.error(`LiteLLM error ${response.status}: ${body}`)
      throw new Error(`LLM request failed: ${response.status}`)
    }

    if (!response.body) throw new Error('No response body from LiteLLM')

    for await (const chunk of parseSSEStream(response.body)) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) yield delta
    }
  }

  // Non-streaming: collect full response (for jobs like commentary generation)
  async complete(
    messages: ChatMessage[],
    model = 'mortgage-advisor',
  ): Promise<string> {
    let result = ''
    for await (const chunk of this.streamChat(messages, model)) {
      result += chunk
    }
    return result
  }
}