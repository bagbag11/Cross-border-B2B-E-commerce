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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { LogisticsRoutesService } from './logistics-routes.service';
import type {
  CreateLogisticsRouteRequest,
  UpdateLogisticsRouteRequest,
  ToggleRouteStatusRequest,
  CreatePricingRuleRequest,
  UpdatePricingRuleRequest,
} from '@shared/api.interface';

@Controller('api/logistics-routes')
export class LogisticsRoutesController {
  constructor(
    private readonly service: LogisticsRoutesService,
  ) {}

  @Get()
  async getList(
    @Query('country') country?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedPage: number = parseInt(page || '1', 10);
    const parsedPageSize: number = parseInt(
      pageSize || '20',
      10,
    );
    const parsedIsActive: string | undefined =
      isActive === 'active'
        ? '启用'
        : isActive === 'inactive'
          ? '禁用'
          : undefined;

    return this.service.getList({
      country,
      isActive: parsedIsActive,
      page: parsedPage,
      pageSize: parsedPageSize,
    });
  }

  @Get('dimension-limits')
  async getDimensionLimits() {
    return this.service.getDimensionLimits();
  }

  @Post()
  @NeedLogin()
  async createRoute(
    @Body() body: CreateLogisticsRouteRequest,
  ) {
    return this.service.create(body);
  }

  @Put('pricing-rules/:id')
  @NeedLogin()
  async updatePricingRule(
    @Param('id') id: string,
    @Body() body: UpdatePricingRuleRequest,
  ) {
    return this.service.updatePricingRule(id, body);
  }

  @Delete('pricing-rules/:id')
  @NeedLogin()
  async deletePricingRule(@Param('id') id: string) {
    return this.service.deletePricingRule(id);
  }

  @Delete(':id')
  @NeedLogin()
  async deleteRoute(@Param('id') id: string) {
    return this.service.deleteRoute(id);
  }

  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Put(':id')
  @NeedLogin()
  async updateRoute(
    @Param('id') id: string,
    @Body() body: UpdateLogisticsRouteRequest,
  ) {
    return this.service.updateBasicInfo(id, body);
  }

  @Patch(':id/toggle-status')
  @NeedLogin()
  async toggleStatus(
    @Param('id') id: string,
    @Body() body: ToggleRouteStatusRequest,
  ) {
    return this.service.toggleStatus(id, body.isActive);
  }

  @Post(':id/pricing-rules')
  @NeedLogin()
  async createPricingRule(
    @Param('id') id: string,
    @Body() body: CreatePricingRuleRequest,
  ) {
    return this.service.createPricingRule(id, body);
  }

  @Post('recalculate-transport-types')
  @NeedLogin()
  async recalculateTransportTypes() {
    return this.service.recalculateTransportTypes();
  }

  @Post('batch-upsert')
  @NeedLogin()
  async batchUpsert(
    @Body() body: { provider: string; routes: Array<Record<string, unknown>> },
  ) {
    return this.service.batchUpsertFromJson(body);
  }

  @Post('sync-bitable')
  @NeedLogin()
  async syncToBitable() {
    return this.service.syncToBitable();
  }
}
// Tue Jul 28 04:41:35 PM CST 2026
