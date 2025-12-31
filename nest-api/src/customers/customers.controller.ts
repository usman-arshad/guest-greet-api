import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerResponseDto,
  EnrollmentResponseDto,
} from './dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('enroll')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Enroll a new customer with face recognition' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Customer enrolled successfully',
    type: EnrollmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or no face detected' })
  @ApiResponse({ status: 503, description: 'Face service unavailable' })
  async enroll(
    @Body() dto: CreateCustomerDto,
    @UploadedFile() profileImage: Express.Multer.File,
  ): Promise<EnrollmentResponseDto> {
    const customer = await this.customersService.enrollCustomer(dto, profileImage);

    return {
      id: customer.id,
      displayName: customer.displayName,
      profileImageUrl: customer.profileImageUrl || '',
      enrolledAt: customer.createdAt,
      message: 'Customer enrolled successfully with face recognition',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  @ApiResponse({ status: 200, type: [CustomerResponseDto] })
  async findAll(@Query('branchId') branchId?: string): Promise<CustomerResponseDto[]> {
    const customers = await this.customersService.findAll(branchId);

    const responses = await Promise.all(
      customers.map(async (customer) => {
        const hasEmbedding = await this.customersService.hasEmbedding(customer.id);
        return CustomerResponseDto.fromEntity(customer, hasEmbedding);
      }),
    );

    return responses;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.findOne(id);
    const hasEmbedding = await this.customersService.hasEmbedding(id);
    return CustomerResponseDto.fromEntity(customer, hasEmbedding);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.update(id, dto);
    const hasEmbedding = await this.customersService.hasEmbedding(id);
    return CustomerResponseDto.fromEntity(customer, hasEmbedding);
  }

  @Put(':id/profile-image')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Update customer profile image and regenerate embedding' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid image or no face detected' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async updateProfileImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() profileImage: Express.Multer.File,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.updateProfileImage(id, profileImage);
    return CustomerResponseDto.fromEntity(customer, true);
  }

  @Post(':id/revoke-consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke customer consent and delete face data' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async revokeConsent(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersService.revokeConsent(id);
    return CustomerResponseDto.fromEntity(customer, false);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer and all associated data' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 204, description: 'Customer deleted' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.customersService.delete(id);
  }
}
