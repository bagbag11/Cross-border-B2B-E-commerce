import { Controller, Post, Body, Req, Get, Query, Delete } from '@nestjs/common';
import type { Request } from 'express';
import { LogisticsInquiryService } from './logistics-inquiry.service';
import type {
  InquiryRequest,
  InquiryResponse,
  UserInputHistoryResponse,
  SaveUserInputHistoryRequest,
  UserInputHistoryListResponse,
} from '@shared/api.interface';

@Controller('api/logistics-inquiry')
export class LogisticsInquiryController {
  constructor(
    private readonly inquiryService: LogisticsInquiryService,
  ) {}

  @Post()
  async submitInquiry(
    @Req() _req: Request,
    @Body() body: InquiryRequest,
  ): Promise<InquiryResponse> {
    return this.inquiryService.inquire(body);
  }

  @Get('user-history')
  async getUserInputHistory(
    @Req() req: Request,
    @Query('field') fieldName: string,
  ): Promise<UserInputHistoryResponse> {
    const userId = req.userContext?.userId || '';
    return this.inquiryService.getUserInputHistory(userId, fieldName);
  }

  @Post('user-history')
  async saveUserInputHistory(
    @Req() req: Request,
    @Body() body: SaveUserInputHistoryRequest,
  ): Promise<void> {
    const userId = req.userContext?.userId || '';
    await this.inquiryService.saveUserInputHistory(userId, body);
  }

  @Delete('user-history')
  async clearUserInputHistory(
    @Req() req: Request,
    @Query('field') fieldName?: string,
  ): Promise<void> {
    const userId = req.userContext?.userId || '';
    await this.inquiryService.clearUserInputHistory(userId, fieldName);
  }

  @Get('user-history-list')
  async getUserInputHistoryList(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<UserInputHistoryListResponse> {
    const userId = req.userContext?.userId || '';
    const pageNum = parseInt(page || '1', 10);
    const size = parseInt(pageSize || '20', 10);
    return this.inquiryService.getUserInputHistoryList(userId, pageNum, size);
  }
}
