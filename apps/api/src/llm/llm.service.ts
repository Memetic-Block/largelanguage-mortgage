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
    customModelName?: string,
    customApiBaseUrl?: string,
  ): AsyncGenerator<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Prepare model for LiteLLM
    let modelToUse = model
    if (model === 'mortgage-advisor-custom-local' && customModelName && customApiBaseUrl) {
      // Replace placeholders in the model name
      modelToUse = `ollama/${customModelName}`
    }

    const body = {
      model: modelToUse,
      messages,
      stream: true,
    }

    // Add custom API base URL if provided for custom local model
    if (model === 'mortgage-advisor-custom-local' && customApiBaseUrl) {
      // We'll handle this in the LiteLLM configuration rather than the API request
      // LiteLLM will use the configured base URL for the custom-local model
    }

    const response = await fetch(`${this.litellmUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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