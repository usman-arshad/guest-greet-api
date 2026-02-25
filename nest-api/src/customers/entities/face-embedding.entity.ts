import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('face_embeddings')
@Index('idx_embedding_customer', ['customerId'])
export class FaceEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.embeddings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'float', array: true })
  embedding: number[];

  @Column({ name: 'model_version', type: 'varchar', length: 50, default: 'arcface-r100' })
  modelVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
