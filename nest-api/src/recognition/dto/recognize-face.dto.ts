import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  Max,
  Min,
} from 'class-validator';

export class RecognizeFaceDto {
  @ApiProperty({
    description: 'Face embedding vector (512 dimensions)',
    type: [Number],
    example: [0.123, -0.456, 0.789],
  })
  @IsArray()
  @ArrayMinSize(128)
  @IsNumber({}, { each: true })
  embedding: number[];

  @ApiProperty({
    description: 'Camera identifier',
    example: 'lobby-cam-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  cameraId?: string;

  @ApiProperty({
    description: 'Branch identifier for multi-location filtering',
    example: 'branch-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({
    description: 'Custom confidence threshold (overrides default)',
    example: 0.8,
    required: false,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}

export class RecognizeFrameDto {
  @ApiProperty({
    description: 'Base64 encoded image frame from CCTV',
    example: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
  })
  @IsString()
  imageBase64: string;

  @ApiProperty({
    description: 'Camera identifier',
    example: 'lobby-cam-01',
    required: false,
  })
  @IsOptional()
  @IsString()
  cameraId?: string;

  @ApiProperty({
    description: 'Branch identifier for multi-location filtering',
    example: 'branch-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  branchId?: string;
}
