import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { Ticket } from './Ticket';
import { Team } from './Team';
import { Activity } from './Activity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'enum',
    enum: ['analyst', 'senior-analyst', 'team-lead', 'manager', 'admin'],
    default: 'analyst'
  })
  role: string;

  @Column({
    type: 'enum',
    enum: ['online', 'away', 'busy', 'offline'],
    default: 'offline'
  })
  status: string;

  @Column({ nullable: true })
  lastSeen: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    defaultTicketQueue?: string;
    keyboardShortcuts?: Record<string, string>;
  };

  @Column({ type: 'json', nullable: true })
  skills: string[];

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  title: string;

  @OneToMany(() => Ticket, ticket => ticket.assignee)
  assignedTickets: Ticket[];

  @OneToMany(() => Ticket, ticket => ticket.createdBy)
  createdTickets: Ticket[];

  @ManyToMany(() => Team, team => team.members)
  @JoinTable({
    name: 'user_teams',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'teamId', referencedColumnName: 'id' }
  })
  teams: Team[];

  @OneToMany(() => Activity, activity => activity.user)
  activities: Activity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual fields
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get initials(): string {
    return `${this.firstName[0]}${this.lastName[0]}`.toUpperCase();
  }
}