import { Controller, Post, Body } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { LogisticsBatchTestService } from './logistics-batch-test.service';
import type { BatchTestRunRequest, BatchTestRunResponse } from '@shared/batch-test.interface';

@Controller('api/batch-test')
export class LogisticsBatchTestController {
  constructor(
    private readonly batchTestService: LogisticsBatchTestService,
  ) {}

  @NeedLogin()
  @Post('run')
  async run(
    @Body() body: BatchTestRunRequest,
  ): Promise<BatchTestRunResponse> {
    return this.batchTestService.run(body);
  }
}
