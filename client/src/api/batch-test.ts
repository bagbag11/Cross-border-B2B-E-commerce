import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { BatchTestRunRequest, BatchTestRunResponse } from '@shared/batch-test.interface';

export async function runBatchTest(
  data: BatchTestRunRequest,
): Promise<BatchTestRunResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/batch-test/run',
      method: 'POST',
      data,
      timeout: 120000,
    });
    return response.data;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number; data?: unknown } })?.response?.status;
    const respData = (error as { response?: { data?: unknown } })?.response?.data;
    const detail = typeof respData === 'object' && respData !== null
      ? JSON.stringify(respData).slice(0, 500)
      : String(respData ?? '');
    const msg = status
      ? `HTTP ${status}${detail ? `: ${detail}` : ''}`
      : (error instanceof Error ? error.message : String(error));
    logger.error('批量测试请求失败', { status, detail: msg });
    throw new Error(msg);
  }
}
