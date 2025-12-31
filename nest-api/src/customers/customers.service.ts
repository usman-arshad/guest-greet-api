import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Customer } from './entities/customer.entity';
import { FaceEmbedding } from './entities/face-embedding.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { FaceServiceClient, CandidateEmbedding } from '../face-service/face-service.client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  private readonly profileImagesPath: string;

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(FaceEmbedding)
    private readonly embeddingRepository: Repository<FaceEmbedding>,
    private readonly faceServiceClient: FaceServiceClient,
    private readonly configService: ConfigService,
  ) {
    this.profileImagesPath = this.configService.get<string>('storage.profileImagesPath') || './uploads/profiles';
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.profileImagesPath)) {
      fs.mkdirSync(this.profileImagesPath, { recursive: true });
    }
  }

  async enrollCustomer(
    dto: CreateCustomerDto,
    profileImage: Express.Multer.File,
  ): Promise<Customer> {
    if (!dto.consentGiven) {
      throw new BadRequestException('Explicit consent is required for enrollment');
    }

    if (!profileImage) {
      throw new BadRequestException('Profile image is required for enrollment');
    }

    const imageBase64 = profileImage.buffer.toString('base64');

    const faces = await this.faceServiceClient.detectFaces(imageBase64);
    if (faces.length === 0) {
      throw new BadRequestException('No face detected in the provided image');
    }
    if (faces.length > 1) {
      throw new BadRequestException('Multiple faces detected. Please provide an image with a single face');
    }

    const embeddingResult = await this.faceServiceClient.generateEmbedding(imageBase64);

    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = path.join(this.profileImagesPath, filename);
    fs.writeFileSync(filePath, profileImage.buffer);

    const customer = this.customerRepository.create({
      displayName: dto.displayName,
      profileImageUrl: `/uploads/profiles/${filename}`,
      consentGiven: true,
      consentGivenAt: new Date(),
      branchId: dto.branchId || null,
      isActive: true,
    });

    const savedCustomer = await this.customerRepository.save(customer);

    const embedding = this.embeddingRepository.create({
      customerId: savedCustomer.id,
      embedding: embeddingResult.embedding,
      modelVersion: embeddingResult.modelVersion,
    });

    await this.embeddingRepository.save(embedding);

    this.logger.log(`Customer ${savedCustomer.id} enrolled successfully`);
    return savedCustomer;
  }

  async findAll(branchId?: string): Promise<Customer[]> {
    const query = this.customerRepository.createQueryBuilder('customer');

    if (branchId) {
      query.where('customer.branchId = :branchId', { branchId });
    }

    return query.orderBy('customer.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['embeddings'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);

    if (dto.displayName !== undefined) {
      customer.displayName = dto.displayName;
    }
    if (dto.isActive !== undefined) {
      customer.isActive = dto.isActive;
    }
    if (dto.branchId !== undefined) {
      customer.branchId = dto.branchId;
    }

    return this.customerRepository.save(customer);
  }

  async revokeConsent(id: string): Promise<Customer> {
    const customer = await this.findOne(id);

    await this.embeddingRepository.delete({ customerId: id });

    customer.consentGiven = false;
    customer.isActive = false;

    this.logger.log(`Consent revoked for customer ${id}, embeddings deleted`);
    return this.customerRepository.save(customer);
  }

  async delete(id: string): Promise<void> {
    const customer = await this.findOne(id);

    if (customer.profileImageUrl) {
      const filePath = path.join(process.cwd(), customer.profileImageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.customerRepository.delete(id);
    this.logger.log(`Customer ${id} deleted`);
  }

  async getConsentedCustomerEmbeddings(branchId?: string): Promise<CandidateEmbedding[]> {
    const query = this.embeddingRepository
      .createQueryBuilder('embedding')
      .innerJoin('embedding.customer', 'customer')
      .where('customer.consentGiven = :consent', { consent: true })
      .andWhere('customer.isActive = :active', { active: true });

    if (branchId) {
      query.andWhere('customer.branchId = :branchId', { branchId });
    }

    const embeddings = await query.getMany();

    return embeddings.map((e) => ({
      customerId: e.customerId,
      embedding: e.embedding,
    }));
  }

  async hasEmbedding(customerId: string): Promise<boolean> {
    const count = await this.embeddingRepository.count({
      where: { customerId },
    });
    return count > 0;
  }

  async updateProfileImage(
    id: string,
    profileImage: Express.Multer.File,
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    if (!customer.consentGiven) {
      throw new BadRequestException('Cannot update image for customer without consent');
    }

    const imageBase64 = profileImage.buffer.toString('base64');

    const faces = await this.faceServiceClient.detectFaces(imageBase64);
    if (faces.length === 0) {
      throw new BadRequestException('No face detected in the provided image');
    }
    if (faces.length > 1) {
      throw new BadRequestException('Multiple faces detected. Please provide an image with a single face');
    }

    const embeddingResult = await this.faceServiceClient.generateEmbedding(imageBase64);

    if (customer.profileImageUrl) {
      const oldPath = path.join(process.cwd(), customer.profileImageUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = path.join(this.profileImagesPath, filename);
    fs.writeFileSync(filePath, profileImage.buffer);

    customer.profileImageUrl = `/uploads/profiles/${filename}`;
    await this.customerRepository.save(customer);

    await this.embeddingRepository.delete({ customerId: id });
    const embedding = this.embeddingRepository.create({
      customerId: id,
      embedding: embeddingResult.embedding,
      modelVersion: embeddingResult.modelVersion,
    });
    await this.embeddingRepository.save(embedding);

    this.logger.log(`Profile image and embedding updated for customer ${id}`);
    return customer;
  }
}
