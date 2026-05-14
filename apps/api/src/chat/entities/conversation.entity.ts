import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm'
import { Message } from './message.entity'

@Entity()
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() sessionId: string
  @OneToMany(() => Message, (m) => m.conversation, { cascade: true })
  messages: Message[]
  @CreateDateColumn() createdAt: Date
}