import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnection } from 'typeorm';
import { Redis } from 'ioredis';
import type { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async checkHealth(@Res() res: Response) {
    let postgresStatus = false;
    let redisStatus = false;

    try {
      const connection = getConnection();
      await connection.query('SELECT 1');
      postgresStatus = true;
    } catch (error) {
      console.error('Postgres health check failed:', error);
    }

    try {
      const redisUrl = this.configService.get('REDIS_URL');
      const redis = new Redis(redisUrl);
      await redis.ping();
      redisStatus = true;
      redis.quit();
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return res.status(200).json({
      status: 'ok',
      postgres: postgresStatus,
      redis: redisStatus,
    });
  }
}
