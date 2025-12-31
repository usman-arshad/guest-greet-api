import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

@Entity('recognition_logs')
export class RecognitionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'camera_id', type: 'varchar', length: 50, nullable: true })
  cameraId: string | null;

  @Column({ name: 'branch_id', type: 'varchar', length: 50, nullable: true })
  branchId: string | null;

  @Column({ name: 'confidence_score', type: 'float', nullable: true })
  confidenceScore: number | null;

  @Column({ name: 'matched', type: 'boolean', default: false })
  matched: boolean;

  @Column({ name: 'greeting_shown', type: 'boolean', default: false })
  greetingShown: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
