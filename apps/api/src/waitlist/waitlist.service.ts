import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Waitlist } from './waitlist.entity'
import { CreateWaitlistDto } from './create-waitlist.dto'

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(Waitlist)
    private repo: Repository<Waitlist>,
  ) {}

  async add(dto: CreateWaitlistDto): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Waitlist)
      .values(dto)
      .orIgnore()   // duplicate email → silent 201, not 409
      .execute()
  }

  async count(): Promise<number> {
    return this.repo.count()
  }
}