import { Controller, Get, Header, Sse } from '@nestjs/common'
import { LlmService } from './llm.service'
import { Observable } from 'rxjs'
import { MessageEvent } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'

@Controller('llm')
export class LlmController {
  constructor(private llm: LlmService) {}

  @Get('test')
  @Sse()
  @Header('Cache-Control', 'no-cache')
  test(): Observable<MessageEvent> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException()
    }

    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of this.llm.streamChat([
            { role: 'user', content: 'Say "LLM connection successful" and nothing else.' },
          ])) {
            subscriber.next({ data: { chunk } } as MessageEvent)
          }
          subscriber.complete()
        } catch (err) {
          subscriber.error(err)
        }
      })()
    })
  }
}