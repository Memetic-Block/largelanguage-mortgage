import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RatesService } from './rates.service';
import { Queue } from 'bull';

@Injectable()
export class RatesScheduler {
  private readonly logger = new Logger(RatesScheduler.name);

  constructor(private readonly ratesService: RatesService) {}

  @Cron('0 0 0 * * 4') // Every Thursday at midnight
  async handleWeeklyRateUpdate() {
    this.logger.log('Starting weekly rate update cron job');
    try {
      const result = await this.ratesService.buildCurrentSnapshot();
      this.logger.log(`Weekly rate update completed successfully: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('Error in weekly rate update cron job:', error);
      throw error;
    }
  }
}