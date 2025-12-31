import { Module } from '@nestjs/common';
import { FaceServiceClient } from './face-service.client';

@Module({
  providers: [FaceServiceClient],
  exports: [FaceServiceClient],
})
export class FaceServiceModule {}
