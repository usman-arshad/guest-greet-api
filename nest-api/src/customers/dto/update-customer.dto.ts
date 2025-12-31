import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdateCustomerDto {
  @ApiProperty({
    description: 'Display name for greeting',
    example: 'Alex',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({
    description: 'Whether the customer is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Branch identifier',
    example: 'branch-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  branchId?: string;
}
