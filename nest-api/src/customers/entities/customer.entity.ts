import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FaceEmbedding } from './face-embedding.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ name: 'profile_image_url', type: 'varchar', length: 500, nullable: true })
  profileImageUrl: string | null;

  @Column({ name: 'consent_given', type: 'boolean', default: false })
  consentGiven: boolean;

  @Column({ name: 'consent_given_at', type: 'timestamp', nullable: true })
  consentGivenAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'branch_id', type: 'varchar', length: 50, nullable: true })
  branchId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => FaceEmbedding, (embedding) => embedding.customer)
  embeddings: FaceEmbedding[];
}
