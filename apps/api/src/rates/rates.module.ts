import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MortgageRate } from './entities/mortgage-rate.entity'
import { RateCommentary } from './entities/rate-commentary.entity'
import { RatesService } from './rates.service'
import { RatesController } from './rates.controller'
import { BullModule } from '@nestjs/bull'
import { RatesProcessor } from './rates.processor'
import { RatesScheduler } from './rates.scheduler'
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [
    TypeOrmModule.forFeature([MortgageRate, RateCommentary]),
    BullModule.registerQueue({ name: 'rates' }),
    ScheduleModule.forRoot(),
  ],
  controllers: [RatesController],
  providers: [RatesService, RatesProcessor, RatesScheduler],
  exports: [RatesService],
})
export class RatesModule {}