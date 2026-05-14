import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm'

@Entity()
@Unique(['rateDate'])
export class RateCommentary {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ type: 'date' })
  rateDate: string                      // matches MortgageRate.date

  @Column('text')
  commentary: string

  @CreateDateColumn() generatedAt: Date
}