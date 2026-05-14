import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { WaitlistModule } from './waitlist/waitlist.module';
import { LlmModule } from './llm/llm.module';
import { ChatModule } from './chat/chat.module';
import { RatesModule } from './rates/rates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env.local' }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        synchronize: false,
        autoLoadEntities: true,
        migrations: ['src/migrations/*{.ts,.js}'],
      }),
      inject: [],
    }),
    BullModule.forRootAsync({
      useFactory: (configService) => ({
        redis: configService.get('REDIS_URL'),
      }),
      inject: [],
    }),
    WaitlistModule,
    LlmModule,
    ChatModule,
    RatesModule,
  ],
  controllers: [AppController, HealthController, LlmController],
  providers: [AppService],
})
export class AppModule {}