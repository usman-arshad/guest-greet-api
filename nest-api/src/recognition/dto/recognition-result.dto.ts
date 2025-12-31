import { ApiProperty } from '@nestjs/swagger';

export class MatchedCustomerDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Alex' })
  displayName: string;

  @ApiProperty({ example: 'https://storage.example.com/profiles/abc123.jpg' })
  profileImageUrl: string;
}

export class RecognitionResultDto {
  @ApiProperty({
    description: 'Whether a match was found above threshold',
    example: true,
  })
  matched: boolean;

  @ApiProperty({
    description: 'Matched customer details (only if matched)',
    type: MatchedCustomerDto,
    required: false,
  })
  customer?: MatchedCustomerDto;

  @ApiProperty({
    description: 'Confidence score of the match',
    example: 0.87,
    required: false,
  })
  confidence?: number;

  @ApiProperty({
    description: 'Greeting message to display',
    example: 'Welcome back, Alex!',
    required: false,
  })
  greeting?: string;
}

export class RecognitionStatusDto {
  @ApiProperty({
    description: 'Whether recognition is globally enabled',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Current confidence threshold',
    example: 0.75,
  })
  confidenceThreshold: number;

  @ApiProperty({
    description: 'Cooldown period in minutes',
    example: 10,
  })
  cooldownMinutes: number;

  @ApiProperty({
    description: 'Whether face service is healthy',
    example: true,
  })
  faceServiceHealthy: boolean;
}

export class ToggleRecognitionDto {
  @ApiProperty({
    description: 'Enable or disable recognition',
    example: true,
  })
  enabled: boolean;
}

export class MultipleRecognitionResultDto {
  @ApiProperty({
    description: 'Number of faces detected in frame',
    example: 2,
  })
  facesDetected: number;

  @ApiProperty({
    description: 'Recognition results for each face',
    type: [RecognitionResultDto],
  })
  results: RecognitionResultDto[];
}
