import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  LogisticsRouteListParams,
  LogisticsRouteListResponse,
  LogisticsRouteDetail,
  CreateLogisticsRouteRequest,
  UpdateLogisticsRouteRequest,
  ToggleRouteStatusRequest,
  CreatePricingRuleRequest,
  UpdatePricingRuleRequest,
  SuccessResponse,
  CreateRouteResponse,
  CreatePricingRuleResponse,
  RouteDimensionLimitsResponse,
} from '@shared/api.interface';

export async function getRouteList(
  params: LogisticsRouteListParams
): Promise<LogisticsRouteListResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-routes',
      method: 'GET',
      params,
    });
    return response.data;
  } catch (error) {
    logger.error('获取物流线路列表失败', error);
    throw error;
  }
}

export async function createRoute(
  data: CreateLogisticsRouteRequest
): Promise<CreateRouteResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-routes',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('新建物流线路失败', error);
    throw error;
  }
}

export async function getRouteDetail(
  id: string
): Promise<LogisticsRouteDetail> {
  try {
    const response = await axiosForBackend({
      url: `/api/logistics-routes/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取线路详情失败', error);
    throw error;
  }
}

export async function updateRoute(
  id: string,
  data: UpdateLogisticsRouteRequest
): Promise<SuccessResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/logistics-routes/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新线路基础信息失败', error);
    throw error;
  }
}

export async function toggleRouteStatus(
  id: string,
  data: ToggleRouteStatusRequest
): Promise<SuccessResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/logistics-routes/${id}/toggle-status`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('切换线路状态失败', error);
    throw error;
  }
}

export async function createPricingRule(
  routeId: string,
  data: CreatePricingRuleRequest
): Promise<CreatePricingRuleResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/logistics-routes/${routeId}/pricing-rules`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('新增报价规则失败', error);
    throw error;
  }
}

export async function updatePricingRule(
  ruleId: string,
  data: UpdatePricingRuleRequest
): Promise<SuccessResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/pricing-rules/${ruleId}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新报价规则失败', error);
    throw error;
  }
}

export async function deletePricingRule(
  ruleId: string
): Promise<SuccessResponse> {
  try {
    const response = await axiosForBackend({
      url: `/api/pricing-rules/${ruleId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除报价规则失败', error);
    throw error;
  }
}

export async function getDimensionLimits(): Promise<RouteDimensionLimitsResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-routes/dimension-limits',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取路线尺寸限制失败', error);
    throw error;
  }
}

export interface SyncToBitableResponse {
  synced: number;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}

export async function syncRoutesToBitable(): Promise<SyncToBitableResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-routes/sync-bitable',
      method: 'POST',
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    logger.error('同步到多维表格失败', error);
    throw error;
  }
}
