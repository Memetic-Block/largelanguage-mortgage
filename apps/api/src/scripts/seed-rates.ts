#!/usr/bin/env node

import { NestFactory } from '@nestjs/core'
import { RatesModule } from './src/rates/rates.module'
import { RatesService } from './src/rates/rates.service'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(RatesModule)
  app.setGlobalPrefix('api')
  
  const configService = app.get(ConfigService)
  const ratesService = app.get(RatesService)
  
  const apiKey = configService.getOrThrow('FRED_API_KEY')
  console.log('Seeding rates with FRED API key...')
  
  try {
    await ratesService.fetchAndStore(52) // Fetch last 52 weeks
    console.log('Rates seeded successfully')
  } catch (error) {
    console.error('Error seeding rates:', error)
    process.exit(1)
  }
  
  await app.close()
}

bootstrap()