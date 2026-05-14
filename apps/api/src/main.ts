import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(express()));
  app.setGlobalPrefix('api');
  
  // Mount BullBoard dashboard
  app.use('/admin/queues', BullBoardModule);
  
  await app.listen(3000);
}
bootstrap();