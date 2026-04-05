import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RecognitionLog } from './entities/recognition-log.entity';
import { CustomersService } from '../customers/customers.service';
import { FaceServiceClient } from '../face-service/face-service.client';
import {
  RecognitionResultDto,
  RecognitionStatusDto,
  MultipleRecognitionResultDto,
} from './dto';
import { RecognitionGateway } from './recognition.gateway';

@Injectable()
export class RecognitionService implements OnModuleInit {
  private readonly logger = new Logger(RecognitionService.name);
  private recognitionEnabled: boolean;
  private readonly confidenceThreshold: number;
  private readonly cooldownMinutes: number;
  private readonly logRetentionDays: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(RecognitionLog)
    private readonly recognitionLogRepository: Repository<RecognitionLog>,
    private readonly customersService: CustomersService,
    private readonly faceServiceClient: FaceServiceClient,
    private readonly configService: ConfigService,
    private readonly recognitionGateway: RecognitionGateway,
  ) {
    this.recognitionEnabled = this.configService.get<boolean>('recognition.enabled') ?? true;
    this.confidenceThreshold = this.configService.get<number>('recognition.confidenceThreshold') || 0.75;
    this.cooldownMinutes = this.configService.get<number>('recognition.cooldownMinutes') ?? 10;
    this.logRetentionDays = this.configService.get<number>('recognition.logRetentionDays') || 30;
  }

  onModuleInit() {
    // Run cleanup on startup, then every 24 hours
    this.cleanupOldLogs();
    this.cleanupInterval = setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000);
  }

  private async cleanupOldLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.logRetentionDays);

    const { affected } = await this.recognitionLogRepository.delete({
      createdAt: LessThan(cutoff),
    });

    if (affected && affected > 0) {
      this.logger.log(`Cleaned up ${affected} recognition logs older than ${this.logRetentionDays} days`);
    }
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
      return { matched: false };
    }

    const isInCooldown = await this.isCustomerInCooldown(matchResult.customerId, cameraId);
    if (isInCooldown) {
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

    const result: RecognitionResultDto = {
      matched: true,
      customer: {
        id: customer.id,
        displayName: customer.displayName,
        profileImageUrl: customer.profileImageUrl || '',
      },
      confidence: matchResult.confidence,
      greeting: `Welcome back, ${customer.displayName}!`,
    };

    this.logger.log(`Match: ${result.customer!.displayName} (confidence: ${result.confidence})`);
    this.recognitionGateway.emitRecognitionResult(result);

    return result;
  }

  async recognizeFromFrame(
    imageBase64: string,
    cameraId?: string,
    branchId?: string,
  ): Promise<MultipleRecognitionResultDto> {
    if (!this.recognitionEnabled) {
      return { facesDetected: 0, results: [] };
    }

    // Single call: detect faces + extract embeddings in one model.get() pass
    const faces = await this.faceServiceClient.detectAndEmbed(imageBase64);

    if (faces.length === 0) {
      return { facesDetected: 0, results: [] };
    }

    // Fetch candidates once for all faces (not per-face)
    const candidates = await this.customersService.getConsentedCustomerEmbeddings(branchId);

    if (candidates.length === 0) {
      return { facesDetected: faces.length, results: [] };
    }

    // Process all faces concurrently
    const matchPromises = faces.map(async (face) => {
      const matchResult = await this.faceServiceClient.matchEmbedding(
        face.embedding,
        candidates,
        this.confidenceThreshold,
      );

      if (!matchResult.matched || !matchResult.customerId) {
        return null;
      }

      const isInCooldown = await this.isCustomerInCooldown(matchResult.customerId, cameraId);
      if (isInCooldown) {
        return null;
      }

      const customer = await this.customersService.findOne(matchResult.customerId);

      await this.logRecognition(
        customer.id,
        cameraId,
        branchId,
        matchResult.confidence,
        true,
      );

      const result: RecognitionResultDto = {
        matched: true,
        customer: {
          id: customer.id,
          displayName: customer.displayName,
          profileImageUrl: customer.profileImageUrl || '',
        },
        confidence: matchResult.confidence,
        greeting: `Welcome back, ${customer.displayName}!`,
      };

      this.recognitionGateway.emitRecognitionResult(result);

      return result;
    });

    const settled = await Promise.all(matchPromises);
    const results = settled.filter((r): r is RecognitionResultDto => r !== null);

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
    if (this.cooldownMinutes === 0) {
      return false;
    }

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
