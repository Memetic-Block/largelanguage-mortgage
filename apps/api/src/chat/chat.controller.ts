import { Controller, Post, Get, Sse, Headers, Query, HttpCode, Param, ParseUUIDPipe, Header } from '@nestjs/common'
import { ChatService } from './chat.service'
import { StreamMessageDto } from './stream-message.dto'
import { Observable } from 'rxjs'
import { MessageEvent } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common'
import { Message } from './entities/message.entity'

@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Post('session')
  @HttpCode(201)
  async createSession(): Promise<{ sessionId: string }> {
    return { sessionId: await this.chat.createSession() }
  }

  @Sse('stream')
  @Header('Cache-Control', 'no-cache')
  stream(
    @Query() dto: StreamMessageDto,
    @Headers('x-api-key') apiKey?: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of this.chat.stream(
            dto.sessionId,
            dto.message,
            dto.model ?? 'mortgage-advisor',
            apiKey,
            dto.customModelName,
            dto.customApiBaseUrl,
          )) {
            subscriber.next({ data: { chunk } } as MessageEvent)
          }
          subscriber.next({ data: { done: true } } as MessageEvent)
          subscriber.complete()
        } catch (err) {
          subscriber.next({ data: { error: (err as Error).message } } as MessageEvent)
          subscriber.complete()
        }
      })()
    })
  }

  @Get(':sessionId/history')
  history(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.chat.getHistory(sessionId)
  }
}