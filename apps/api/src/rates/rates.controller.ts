import { Controller, Post } from '@nestjs/common'
import { RatesService } from './rates.service'
import { ForbiddenException } from '@nestjs/common'

@Controller('rates')
export class RatesController {
  constructor(private rates: RatesService) {}

  // Dev-only: trigger a live FRED fetch
  @Post('fetch-now')
  async fetchNow() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException()
    return this.rates.fetchAndStore(1)
  }
}