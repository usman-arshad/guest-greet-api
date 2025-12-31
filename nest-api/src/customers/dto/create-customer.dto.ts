import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  MinLength,
  Equals,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Display name for greeting (first name recommended)',
    example: 'Alex',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @ApiProperty({
    description: 'Explicit consent flag - must be true for enrollment',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'Consent must be explicitly given (true) for enrollment' })
  consentGiven: boolean;

  @ApiProperty({
    description: 'Branch identifier for multi-location support',
    example: 'branch-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchId?: string;
}
