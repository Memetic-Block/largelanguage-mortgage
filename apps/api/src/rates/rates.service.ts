import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MortgageRate } from './entities/mortgage-rate.entity'
import { RateCommentary } from './entities/rate-commentary.entity'
import { ConfigService } from '@nestjs/config'
import { fetchFredSeries, FRED_SERIES } from './fred.client'
import { Redis } from 'ioredis'

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name)
  private redisClient: Redis

  constructor(
    @InjectRepository(MortgageRate) private rateRepo: Repository<MortgageRate>,
    @InjectRepository(RateCommentary) private commentaryRepo: Repository<RateCommentary>,
    private config: ConfigService,
  ) {
    // Initialize Redis client
    const redisUrl = this.config.get<string>('REDIS_URL')
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl)
    }
  }

  async fetchAndStore(limit = 1): Promise<MortgageRate[]> {
    const apiKey = this.config.getOrThrow('FRED_API_KEY')
    const stored: MortgageRate[] = []

    for (const { seriesId, loanType } of FRED_SERIES) {
      const observations = await fetchFredSeries(seriesId, apiKey, { limit })

      for (const obs of observations) {
        const [saved] = await this.rateRepo
          .createQueryBuilder()
          .insert()
          .into(MortgageRate)
          .values({
            date: obs.date,
            loanType,
            rate: parseFloat(obs.value),
            source: 'freddie_mac_pmms',
          })
          .orUpdate(['rate'], ['date', 'loanType'])
          .returning('*')
          .execute()
          .then((r) => r.generatedMaps)

        stored.push(saved as MortgageRate)
        this.logger.log(`Stored ${loanType} rate for ${obs.date}: ${obs.value}%`)
      }
    }

    return stored
  }

  async buildCurrentSnapshot(): Promise<Record<string, { rate: number; points: number; date: string }>> {
    const cacheKey = 'current-rates-snapshot'
    
    // Try to get from cache first
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey)
        if (cached) {
          this.logger.log('Returning cached rates snapshot')
          return JSON.parse(cached)
        }
      } catch (error) {
        this.logger.warn('Redis cache read failed:', error)
      }
    }

    const loanTypes = ['30yr_fixed', '15yr_fixed', '5_1_arm']
    const snapshot: Record<string, { rate: number; points: number; date: string }> = {}

    for (const loanType of loanTypes) {
      const latest = await this.rateRepo.findOne({
        where: { loanType },
        order: { date: 'DESC' },
      })
      if (latest) {
        snapshot[loanType] = { rate: Number(latest.rate), points: Number(latest.points), date: latest.date }
      }
    }

    // Cache the result
    if (this.redisClient) {
      try {
        await this.redisClient.setex(cacheKey, 300, JSON.stringify(snapshot)) // Cache for 5 minutes
        this.logger.log('Cached rates snapshot')
      } catch (error) {
        this.logger.warn('Redis cache write failed:', error)
      }
    }

    return snapshot
  }

  async getCurrentRates(): Promise<Record<string, { rate: number; points: number; date: string }>> {
    const cacheKey = 'current-rates-snapshot'
    
    // Try to get from cache first
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey)
        if (cached) {
          this.logger.log('Returning cached rates snapshot')
          return JSON.parse(cached)
        }
      } catch (error) {
        this.logger.warn('Redis cache read failed:', error)
      }
    }

    const loanTypes = ['30yr_fixed', '15yr_fixed', '5_1_arm']
    const snapshot: Record<string, { rate: number; points: number; date: string }> = {}

    for (const loanType of loanTypes) {
      const latest = await this.rateRepo.findOne({
        where: { loanType },
        order: { date: 'DESC' },
      })
      if (latest) {
        snapshot[loanType] = { rate: Number(latest.rate), points: Number(latest.points), date: latest.date }
      }
    }

    // Cache the result
    if (this.redisClient) {
      try {
        await this.redisClient.setex(cacheKey, 300, JSON.stringify(snapshot)) // Cache for 5 minutes
        this.logger.log('Cached rates snapshot')
      } catch (error) {
        this.logger.warn('Redis cache write failed:', error)
      }
    }

    return snapshot
  }

  async getHistory(loanType: string, weeks: number): Promise<MortgageRate[]> {
    return this.rateRepo.find({
      where: { loanType },
      order: { date: 'ASC' },             // ASC for charting (chronological)
      take: Math.min(weeks, 156),         // cap at 3 years
    })
  }

  async getLatestCommentary(): Promise<RateCommentary | null> {
    return this.commentaryRepo.findOne({
      order: { rateDate: 'DESC' },
    })
  }
}