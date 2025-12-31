import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RecognitionLog } from './entities/recognition-log.entity';
import { CustomersService } from '../customers/customers.service';
import { FaceServiceClient } from '../face-service/face-service.client';
import {
  RecognitionResultDto,
  RecognitionStatusDto,
  MultipleRecognitionResultDto,
} from './dto';

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);
  private recognitionEnabled: boolean;
  private readonly confidenceThreshold: number;
  private readonly cooldownMinutes: number;

  constructor(
    @InjectRepository(RecognitionLog)
    private readonly recognitionLogRepository: Repository<RecognitionLog>,
    private readonly customersService: CustomersService,
    private readonly faceServiceClient: FaceServiceClient,
    private readonly configService: ConfigService,
  ) {
    this.recognitionEnabled = this.configService.get<boolean>('recognition.enabled') ?? true;
    this.confidenceThreshold = this.configService.get<number>('recognition.confidenceThreshold') || 0.75;
    this.cooldownMinutes = this.configService.get<number>('recognition.cooldownMinutes') || 10;
  }

  async recognizeFromEmbedding(
    embedding: number[],
    cameraId?: string,
    branchId?: string,
    threshold?: number,
  ): Promise<RecognitionResultDto> {
    if (!this.recognitionEnabled) {
      return { matched: false };
    }

    const candidates = await this.customersService.getConsentedCustomerEmbeddings(branchId);

    if (candidates.length === 0) {
      return { matched: false };
    }

    const matchResult = await this.faceServiceClient.matchEmbedding(
      embedding,
      candidates,
      threshold || this.confidenceThreshold,
    );

    if (!matchResult.matched || !matchResult.customerId) {
      await this.logRecognition(null, cameraId, branchId, matchResult.confidence, false);
      return { matched: false };
    }

    const isInCooldown = await this.isCustomerInCooldown(matchResult.customerId, cameraId);
    if (isInCooldown) {
      this.logger.debug(`Customer ${matchResult.customerId} in cooldown, skipping greeting`);
      return { matched: false };
    }

    const customer = await this.customersService.findOne(matchResult.customerId);

    await this.logRecognition(
      customer.id,
      cameraId,
      branchId,
      matchResult.confidence,
      true,
    );

    return {
      matched: true,
      customer: {
        id: customer.id,
        displayName: customer.displayName,
        profileImageUrl: customer.profileImageUrl || '',
      },
      confidence: matchResult.confidence,
      greeting: `Welcome back, ${customer.displayName}!`,
    };
  }

  async recognizeFromFrame(
    imageBase64: string,
    cameraId?: string,
    branchId?: string,
  ): Promise<MultipleRecognitionResultDto> {
    if (!this.recognitionEnabled) {
      return { facesDetected: 0, results: [] };
    }

    const faces = await this.faceServiceClient.detectFaces(imageBase64);

    if (faces.length === 0) {
      return { facesDetected: 0, results: [] };
    }

    const results: RecognitionResultDto[] = [];

    for (const face of faces) {
      const embeddingResult = await this.faceServiceClient.generateEmbedding(imageBase64);

      const result = await this.recognizeFromEmbedding(
        embeddingResult.embedding,
        cameraId,
        branchId,
      );

      if (result.matched) {
        results.push(result);
      }
    }

    return {
      facesDetected: faces.length,
      results,
    };
  }

  async getStatus(): Promise<RecognitionStatusDto> {
    const faceServiceHealthy = await this.faceServiceClient.healthCheck();

    return {
      enabled: this.recognitionEnabled,
      confidenceThreshold: this.confidenceThreshold,
      cooldownMinutes: this.cooldownMinutes,
      faceServiceHealthy,
    };
  }

  setEnabled(enabled: boolean): RecognitionStatusDto {
    this.recognitionEnabled = enabled;
    this.logger.log(`Recognition system ${enabled ? 'enabled' : 'disabled'}`);

    return {
      enabled: this.recognitionEnabled,
      confidenceThreshold: this.confidenceThreshold,
      cooldownMinutes: this.cooldownMinutes,
      faceServiceHealthy: true,
    };
  }

  private async isCustomerInCooldown(
    customerId: string,
    cameraId?: string,
  ): Promise<boolean> {
    const cooldownTime = new Date();
    cooldownTime.setMinutes(cooldownTime.getMinutes() - this.cooldownMinutes);

    const query = this.recognitionLogRepository.createQueryBuilder('log')
      .where('log.customerId = :customerId', { customerId })
      .andWhere('log.greetingShown = :shown', { shown: true })
      .andWhere('log.createdAt > :cooldownTime', { cooldownTime });

    if (cameraId) {
      query.andWhere('log.cameraId = :cameraId', { cameraId });
    }

    const recentGreeting = await query.getOne();
    return !!recentGreeting;
  }

  private async logRecognition(
    customerId: string | null,
    cameraId: string | undefined,
    branchId: string | undefined,
    confidence: number,
    greetingShown: boolean,
  ): Promise<void> {
    const log = this.recognitionLogRepository.create({
      customerId,
      cameraId: cameraId || null,
      branchId: branchId || null,
      confidenceScore: confidence,
      matched: !!customerId,
      greetingShown,
    });

    await this.recognitionLogRepository.save(log);
  }

  async getRecognitionLogs(
    limit = 100,
    branchId?: string,
    cameraId?: string,
  ): Promise<RecognitionLog[]> {
    const query = this.recognitionLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.customer', 'customer')
      .orderBy('log.createdAt', 'DESC')
      .take(limit);

    if (branchId) {
      query.andWhere('log.branchId = :branchId', { branchId });
    }

    if (cameraId) {
      query.andWhere('log.cameraId = :cameraId', { cameraId });
    }

    return query.getMany();
  }
}
