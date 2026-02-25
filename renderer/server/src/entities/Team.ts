import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { User } from './User';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  department: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'leadId' })
  lead: User;

  @Column({ nullable: true })
  leadId: string;

  @ManyToMany(() => User, user => user.teams)
  members: User[];

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[]; // e.g., ['Mac', 'Network', 'Printers']

  @Column({ type: 'json', nullable: true })
  schedule: {
    monday?: { start: string; end: string }[];
    tuesday?: { start: string; end: string }[];
    wednesday?: { start: string; end: string }[];
    thursday?: { start: string; end: string }[];
    friday?: { start: string; end: string }[];
    saturday?: { start: string; end: string }[];
    sunday?: { start: string; end: string }[];
    timezone: string;
  };

  @Column({ type: 'json', nullable: true })
  metrics: {
    ticketsResolved: number;
    averageResponseTime: number;
    satisfaction: number;
    period: 'day' | 'week' | 'month';
    updatedAt: Date;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}