import { Module } from '@nestjs/common';
import { LogisticsBatchTestController } from './logistics-batch-test.controller';
import { LogisticsBatchTestService } from './logistics-batch-test.service';
import { LogisticsInquiryModule } from '../logistics-inquiry/logistics-inquiry.module';

@Module({
  imports: [LogisticsInquiryModule],
  controllers: [LogisticsBatchTestController],
  providers: [LogisticsBatchTestService],
})
export class LogisticsBatchTestModule {}
