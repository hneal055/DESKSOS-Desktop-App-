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

@Entity('knowledge_articles')
export class KnowledgeArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string;

  @Column({
    type: 'enum',
    enum: ['troubleshooting', 'how-to', 'reference', 'announcement', 'faq'],
    default: 'troubleshooting'
  })
  type: string;

  @Column({ type: 'simple-array' })
  categories: string[];

  @Column({ type: 'simple-array' })
  tags: string[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: string;

  @Column({ default: 0 })
  views: number;

  @Column({ default: 0 })
  likes: number;

  @Column({ type: 'simple-array', nullable: true })
  likedBy: string[];

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[];

  @Column({ type: 'json', nullable: true })
  relatedArticles: string[]; // IDs of related articles

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: true })
  isPublished: boolean;

  @Column({ nullable: true })
  publishedAt: Date;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'simple-array', nullable: true })
  applicableVersions: string[]; // e.g., ['Windows 10', 'Windows 11']

  @Column({ type: 'simple-array', nullable: true })
  applicableSoftware: string[]; // e.g., ['Outlook', 'Chrome']

  @Column({ type: 'json', nullable: true })
  metadata: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    timeToComplete?: number;
    prerequisites?: string[];
    steps?: { order: number; description: string; command?: string }[];
  };

  @Column({ type: 'json', nullable: true })
  searchKeywords: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}