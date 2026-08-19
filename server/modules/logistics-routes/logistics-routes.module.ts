import { Module } from '@nestjs/common';
import { LogisticsRoutesController } from './logistics-routes.controller';
import { LogisticsRoutesService } from './logistics-routes.service';

@Module({
  controllers: [LogisticsRoutesController],
  providers: [LogisticsRoutesService],
})
export class LogisticsRoutesModule {}
