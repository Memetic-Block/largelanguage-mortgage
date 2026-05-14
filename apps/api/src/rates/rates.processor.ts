import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { RatesService } from './rates.service';
import { Logger } from '@nestjs/common';

@Processor('rates')
export class RatesProcessor {
  private readonly logger = new Logger(RatesProcessor.name);

  constructor(private readonly ratesService: RatesService) {}

  @Process('fetch-rates')
  async handleFetchRates(job: Job) {
    this.logger.log('Starting fetch-rates job');
    try {
      const result = await this.ratesService.buildCurrentSnapshot();
      this.logger.log(`Fetch-rates job completed successfully: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('Error in fetch-rates job:', error);
      throw error;
    }
  }
}