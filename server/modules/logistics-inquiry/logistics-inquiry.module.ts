import { Module } from '@nestjs/common';
import { LogisticsInquiryController } from './logistics-inquiry.controller';
import { LogisticsInquiryService } from './logistics-inquiry.service';

@Module({
  controllers: [LogisticsInquiryController],
  providers: [LogisticsInquiryService],
  exports: [LogisticsInquiryService],
})
export class LogisticsInquiryModule {}
