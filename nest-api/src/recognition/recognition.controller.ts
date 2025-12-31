import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RecognitionService } from './recognition.service';
import {
  RecognizeFaceDto,
  RecognizeFrameDto,
  RecognitionResultDto,
  RecognitionStatusDto,
  ToggleRecognitionDto,
  MultipleRecognitionResultDto,
} from './dto';
import { RecognitionLog } from './entities/recognition-log.entity';

@ApiTags('recognition')
@Controller('recognition')
export class RecognitionController {
  constructor(private readonly recognitionService: RecognitionService) {}

  @Post('identify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Identify a face from pre-computed embedding' })
  @ApiResponse({
    status: 200,
    description: 'Recognition result',
    type: RecognitionResultDto,
  })
  @ApiResponse({ status: 503, description: 'Recognition service unavailable' })
  async identifyFromEmbedding(
    @Body() dto: RecognizeFaceDto,
  ): Promise<RecognitionResultDto> {
    return this.recognitionService.recognizeFromEmbedding(
      dto.embedding,
      dto.cameraId,
      dto.branchId,
      dto.threshold,
    );
  }

  @Post('identify-frame')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detect and identify faces from a video frame' })
  @ApiResponse({
    status: 200,
    description: 'Recognition results for detected faces',
    type: MultipleRecognitionResultDto,
  })
  @ApiResponse({ status: 503, description: 'Face service unavailable' })
  async identifyFromFrame(
    @Body() dto: RecognizeFrameDto,
  ): Promise<MultipleRecognitionResultDto> {
    return this.recognitionService.recognizeFromFrame(
      dto.imageBase64,
      dto.cameraId,
      dto.branchId,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Get recognition system status' })
  @ApiResponse({
    status: 200,
    description: 'Current recognition status',
    type: RecognitionStatusDto,
  })
  async getStatus(): Promise<RecognitionStatusDto> {
    return this.recognitionService.getStatus();
  }

  @Patch('toggle')
  @ApiOperation({ summary: 'Enable or disable recognition globally' })
  @ApiResponse({
    status: 200,
    description: 'Updated recognition status',
    type: RecognitionStatusDto,
  })
  toggleRecognition(
    @Body() dto: ToggleRecognitionDto,
  ): RecognitionStatusDto {
    return this.recognitionService.setEnabled(dto.enabled);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get recognition event logs' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max records to return' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch' })
  @ApiQuery({ name: 'cameraId', required: false, description: 'Filter by camera' })
  @ApiResponse({
    status: 200,
    description: 'List of recognition logs',
  })
  async getLogs(
    @Query('limit') limit?: number,
    @Query('branchId') branchId?: string,
    @Query('cameraId') cameraId?: string,
  ): Promise<RecognitionLog[]> {
    return this.recognitionService.getRecognitionLogs(
      limit ? parseInt(String(limit), 10) : 100,
      branchId,
      cameraId,
    );
  }
}
