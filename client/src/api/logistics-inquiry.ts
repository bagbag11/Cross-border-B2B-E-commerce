import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  InquiryRequest,
  InquiryResponse,
  UserInputHistoryResponse,
  SaveUserInputHistoryRequest,
} from '@shared/api.interface';

export async function submitInquiry(
  data: InquiryRequest
): Promise<InquiryResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-inquiry',
      method: 'POST',
      data,
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    logger.error('提交询价请求失败', error);
    throw error;
  }
}

export async function getUserInputHistory(
  fieldName: string
): Promise<UserInputHistoryResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/logistics-inquiry/user-history',
      method: 'GET',
      params: { field: fieldName },
    });
    return response.data;
  } catch (error) {
    logger.error('获取用户历史输入失败', error);
    return { items: [] };
  }
}

export async function saveUserInputHistory(
  data: SaveUserInputHistoryRequest
): Promise<void> {
  try {
    await axiosForBackend({
      url: '/api/logistics-inquiry/user-history',
      method: 'POST',
      data,
    });
  } catch (error) {
    logger.error('保存用户历史输入失败', error);
  }
}

export async function clearUserInputHistory(fieldName?: string): Promise<void> {
  try {
    await axiosForBackend({
      url: '/api/logistics-inquiry/user-history',
      method: 'DELETE',
      params: fieldName ? { field: fieldName } : undefined,
    });
  } catch (error) {
    logger.error('清空用户历史输入失败', error);
  }
}
