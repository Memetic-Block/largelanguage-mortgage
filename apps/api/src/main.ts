import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(express()));
  app.setGlobalPrefix('api');
  
  // Mount BullBoard dashboard
  app.use('/admin/queues', BullBoardModule);
  
  await app.listen(process.env.PORT ?? 3000);

  console.log(`API is running on port ${process.env.PORT ?? 3000}`);
}
bootstrap()
  .then(() => {
    console.log(`LargeLanguageMortgage API is running on port ${process.env.PORT ?? 3000}`)
  })
  .catch((error) => {
    console.error('Error starting LargeLanguageMortgage API:', error)
    process.exit(1)
  })