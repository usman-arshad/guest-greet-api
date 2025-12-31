import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecognitionController } from './recognition.controller';
import { RecognitionService } from './recognition.service';
import { RecognitionLog } from './entities/recognition-log.entity';
import { CustomersModule } from '../customers/customers.module';
import { FaceServiceModule } from '../face-service/face-service.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecognitionLog]),
    CustomersModule,
    FaceServiceModule,
  ],
  controllers: [RecognitionController],
  providers: [RecognitionService],
  exports: [RecognitionService],
})
export class RecognitionModule {}
