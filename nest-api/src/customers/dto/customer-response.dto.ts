import { ApiProperty } from '@nestjs/swagger';
import { Customer } from '../entities/customer.entity';

export class CustomerResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Alex' })
  displayName: string;

  @ApiProperty({ example: 'https://storage.example.com/profiles/abc123.jpg' })
  profileImageUrl: string | null;

  @ApiProperty({ example: true })
  consentGiven: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  consentGivenAt: Date | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'branch-001' })
  branchId: string | null;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: true })
  hasEmbedding: boolean;

  static fromEntity(customer: Customer, hasEmbedding = false): CustomerResponseDto {
    const dto = new CustomerResponseDto();
    dto.id = customer.id;
    dto.displayName = customer.displayName;
    dto.profileImageUrl = customer.profileImageUrl;
    dto.consentGiven = customer.consentGiven;
    dto.consentGivenAt = customer.consentGivenAt;
    dto.isActive = customer.isActive;
    dto.branchId = customer.branchId;
    dto.createdAt = customer.createdAt;
    dto.hasEmbedding = hasEmbedding;
    return dto;
  }
}

export class EnrollmentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Alex' })
  displayName: string;

  @ApiProperty({ example: 'https://storage.example.com/profiles/abc123.jpg' })
  profileImageUrl: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  enrolledAt: Date;

  @ApiProperty({ example: 'Customer enrolled successfully with face recognition' })
  message: string;
}
