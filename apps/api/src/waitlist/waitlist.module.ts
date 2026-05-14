import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Waitlist } from './waitlist.entity'
import { WaitlistService } from './waitlist.service'
import { WaitlistController } from './waitlist.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Waitlist])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}