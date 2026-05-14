import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm'

@Entity()
@Unique(['date', 'loanType'])          // upsert key — one row per loan type per week
export class MortgageRate {
  @PrimaryGeneratedColumn('uuid') id: string

  @Column({ type: 'date' })
  date: string                          // YYYY-MM-DD (the Thursday of that week)

  @Column()
  loanType: string                      // '30yr_fixed' | '15yr_fixed' | '5_1_arm'

  @Column({ type: 'numeric', precision: 5, scale: 3 })
  rate: number                          // e.g. 6.875

  @Column({ type: 'numeric', precision: 4, scale: 2, nullable: true })
  points: number                        // Freddie Mac PMMS includes avg points

  @Column()
  source: string                        // 'freddie_mac_pmms'

  @CreateDateColumn() createdAt: Date
}