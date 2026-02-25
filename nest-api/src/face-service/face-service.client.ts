import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DetectedFace {
  bbox: number[];
  landmarks: number[][];
  confidence: number;
}

export interface EmbeddingResult {
  embedding: number[];
  modelVersion: string;
}

export interface CandidateEmbedding {
  customerId: string;
  embedding: number[];
}

export interface MatchResult {
  matched: boolean;
  customerId: string | null;
  confidence: number;
}

export interface FaceWithEmbedding {
  bbox: number[];
  confidence: number;
  embedding: number[];
}

interface DetectFacesResponse {
  faces: DetectedFace[];
  count: number;
}

interface GenerateEmbeddingResponse {
  embedding: number[];
  model_version: string;
}

interface DetectAndEmbedResponse {
  faces: FaceWithEmbedding[];
  count: number;
  model_version: string;
}

interface MatchResponse {
  matched: boolean;
  customer_id: string | null;
  confidence: number;
}

@Injectable()
export class FaceServiceClient {
  private readonly logger = new Logger(FaceServiceClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('faceService.url') || 'http://localhost:8000';
    this.timeout = this.configService.get<number>('faceService.timeout') || 5000;
  }

  async detectFaces(imageBase64: string): Promise<DetectedFace[]> {
    try {
      const response = await this.post<DetectFacesResponse>('/detect-faces', {
        image_base64: imageBase64,
      });
      return response.faces || [];
    } catch (error) {
      this.logger.error('Face detection failed', error);
      throw new HttpException(
        'Face detection service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async generateEmbedding(faceImageBase64: string): Promise<EmbeddingResult> {
    try {
      const response = await this.post<GenerateEmbeddingResponse>('/generate-embedding', {
        face_image_base64: faceImageBase64,
      });
      return {
        embedding: response.embedding,
        modelVersion: response.model_version,
      };
    } catch (error) {
      this.logger.error('Embedding generation failed', error);
      throw new HttpException(
        'Face embedding service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async detectAndEmbed(imageBase64: string): Promise<FaceWithEmbedding[]> {
    try {
      const response = await this.post<DetectAndEmbedResponse>('/detect-and-embed', {
        image_base64: imageBase64,
      });
      return response.faces || [];
    } catch (error) {
      this.logger.error('Detect and embed failed', error);
      throw new HttpException(
        'Face service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async matchEmbedding(
    queryEmbedding: number[],
    candidates: CandidateEmbedding[],
    threshold?: number,
  ): Promise<MatchResult> {
    try {
      const response = await this.post<MatchResponse>('/match', {
        query_embedding: queryEmbedding,
        candidate_embeddings: candidates.map((c) => ({
          customer_id: c.customerId,
          embedding: c.embedding,
        })),
        threshold: threshold || this.configService.get<number>('recognition.confidenceThreshold'),
      });
      return {
        matched: response.matched,
        customerId: response.customer_id,
        confidence: response.confidence,
      };
    } catch (error) {
      this.logger.error('Embedding matching failed', error);
      throw new HttpException(
        'Face matching service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Face service error: ${response.status} - ${errorText}`);
      throw new Error(`Face service returned ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}
