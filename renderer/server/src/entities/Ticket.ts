import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn
} from 'typeorm';
import { User } from './User';
import { TicketNote } from './TicketNote';
import { Asset } from './Asset';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketNumber: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['incident', 'service-request', 'problem', 'change'],
    default: 'incident'
  })
  type: string;

  @Column({
    type: 'enum',
    enum: ['new', 'open', 'in-progress', 'pending', 'resolved', 'closed', 'cancelled'],
    default: 'new'
  })
  status: string;

  @Column({
    type: 'enum',
    enum: ['critical', 'high', 'medium', 'low', 'planning'],
    default: 'medium'
  })
  priority: string;

  @Column({
    type: 'enum',
    enum: ['hardware', 'software', 'network', 'printer', 'email', 'access', 'other'],
    default: 'other'
  })
  category: string;

  @Column({ nullable: true })
  subcategory: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User;

  @Column({ nullable: true })
  assignedToId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column({ nullable: true })
  requesterId: string;

  @Column({ type: 'json', nullable: true })
  contactInfo: {
    name: string;
    email: string;
    phone?: string;
    department?: string;
    location?: string;
  };

  @Column({ type: 'json', nullable: true })
  systemInfo: {
    computerName?: string;
    os?: string;
    ipAddress?: string;
    macAddress?: string;
    software?: string[];
    hardware?: Record<string, string>;
  };

  @Column({ type: 'json', nullable: true })
  diagnostics: {
    before?: any;
    after?: any;
    logs?: string[];
    steps?: string[];
    timeSpent?: number;
  };

  @OneToMany(() => TicketNote, note => note.ticket, { cascade: true })
  notes: TicketNote[];

  @ManyToOne(() => Asset, { nullable: true })
  @JoinColumn({ name: 'assetId' })
  asset: Asset;

  @Column({ nullable: true })
  assetId: string;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[];

  @Column({ type: 'json', nullable: true })
  customFields: Record<string, any>;

  @Column({ nullable: true })
  resolution: string;

  @Column({ nullable: true })
  resolutionCode: string;

  @Column({ type: 'int', default: 0 })
  timeSpent: number; // in minutes

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ nullable: true })
  escalatedTo: string;

  @Column({ default: false })
  isEscalated: boolean;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  satisfaction: number; // 1-5 rating

  @Column({ nullable: true })
  satisfactionComment: string;

  @Column({ type: 'json', nullable: true })
  audit: {
    created: { at: Date; by: string };
    assigned: { at: Date; by: string; to: string }[];
    status: { at: Date; from: string; to: string; by: string }[];
    notes: { count: number };
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncedAt: Date;
}