import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'
import { LlmService } from '../llm/llm.service'
import { ChatMessage } from '../llm/llm.service'
import { MORTGAGE_ADVISOR_SYSTEM_PROMPT } from './chat.constants'
import { randomUUID } from 'crypto'

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private llm: LlmService,
  ) {}

  async createSession(): Promise<string> {
    const sessionId = randomUUID()
    await this.convRepo.save({ sessionId })
    return sessionId
  }

  async getHistory(sessionId: string): Promise<Message[]> {
    const conv = await this.convRepo.findOne({
      where: { sessionId },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    })
    return conv?.messages ?? []
  }

  async *stream(
    sessionId: string,
    userMessage: string,
    model: string,
    apiKey?: string,
  ): AsyncGenerator<string> {
    const conv = await this.convRepo.findOne({
      where: { sessionId },
      relations: ['messages'],
      order: { messages: { createdAt: 'ASC' } },
    })
    if (!conv) throw new NotFoundException('Session not found')

    // Persist user message
    await this.msgRepo.save({ conversation: conv, role: 'user', content: userMessage })

    // Build message array for LLM
    const messages: ChatMessage[] = [
      { role: 'system', content: MORTGAGE_ADVISOR_SYSTEM_PROMPT },
      ...conv.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ]

    // Stream and collect for persistence
    let fullResponse = ''
    for await (const chunk of this.llm.streamChat(messages, model, apiKey)) {
      fullResponse += chunk
      yield chunk
    }

    // Persist assistant response
    await this.msgRepo.save({
      conversation: conv,
      role: 'assistant',
      content: fullResponse,
      modelUsed: model,
    })
  }
}