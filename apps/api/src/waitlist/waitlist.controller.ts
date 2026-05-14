import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common'
import { WaitlistService } from './waitlist.service'
import { CreateWaitlistDto } from './create-waitlist.dto'

@Controller('waitlist')
export class WaitlistController {
  constructor(private service: WaitlistService) {}

  @Post()
  @HttpCode(201)
  async add(@Body() dto: CreateWaitlistDto): Promise<void> {
    await this.service.add(dto)
  }

  @Get('count')
  async count(): Promise<{ count: number }> {
    return { count: await this.service.count() }
  }
}