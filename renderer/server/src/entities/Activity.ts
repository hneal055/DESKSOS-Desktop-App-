import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { User } from './User';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // e.g., 'ticket.created', 'user.login', 'knowledge.viewed'

  @Column({ nullable: true })
  entityType: string; // 'ticket', 'user', 'knowledge', 'asset'

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @Column({ type: 'json', nullable: true })
  changes: {
    before?: any;
    after?: any;
    fields?: string[];
  };

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ nullable: true })
  requestId: string;

  @Column({ type: 'int', nullable: true })
  responseTime: number; // in ms

  @CreateDateColumn()
  createdAt: Date;
}