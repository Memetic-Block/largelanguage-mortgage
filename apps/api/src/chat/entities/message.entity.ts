import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm'
import { Conversation } from './conversation.entity'

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string
  @ManyToOne(() => Conversation, (c) => c.messages)
  conversation: Conversation
  @Column() role: 'user' | 'assistant' | 'system'
  @Column('text') content: string
  @Column({ nullable: true }) modelUsed: string
  @CreateDateColumn() createdAt: Date
}