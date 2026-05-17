import { Controller, Post, Get, Query, DefaultValuePipe, ParseIntPipe, ForbiddenException } from '@nestjs/common'
import { RatesService } from './rates.service'

@Controller('rates')
export class RatesController {
  constructor(private rates: RatesService) {}

  // Dev-only: trigger a live FRED fetch
  @Post('fetch-now')
  async fetchNow() {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException()
    return this.rates.fetchAndStore(1)
  }

  @Get('current')
  getCurrentRates() {
    return this.rates.getCurrentRates()
  }

  @Get('history')
  getHistory(
    @Query('weeks', new DefaultValuePipe(52), ParseIntPipe) weeks: number,
    @Query('loanType', new DefaultValuePipe('30yr_fixed')) loanType: string,
  ) {
    return this.rates.getHistory(loanType, weeks)
  }

  @Get('commentary')
  getCommentary() {
    return this.rates.getLatestCommentary()
  }
}