import type { ChannelType, InquiryPriceDetail } from './api.interface';

/** 单条期望报价（来自 Excel，同 recordId 下可能有多条） */
export interface BatchTestExpectation {
  company: string;
  channelType: string; // 空运 / 海运 / 陆运 / 未知
  expectedPrice: number;
  deliveryTime: string;
  remark: string;
}

/** 单条测试用例（按 recordId 分组后的输入 + 期望） */
export interface BatchTestCase {
  recordId: string;
  category: string;
  country: string;
  postalCode: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  packagingType: string;
  expectations: BatchTestExpectation[];
}

/** 批量测试运行请求 */
export interface BatchTestRunRequest {
  cases: BatchTestCase[];
}

/** 返回路线（带匹配标注） */
export interface BatchTestReturnedItem {
  providerName: string | null;
  channelType: ChannelType | null;
  channelTypeLabel: string;
  routeName: string;
  totalPrice: number;
  tag: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  billingFormula?: string[];
  priceDetail?: InquiryPriceDetail;
  matchedExpectations: {
    company: string;
    channelType: string;
    expectedPrice: number;
    deliveryTime: string;
    priceDiff: number;
    expectationIndex: number;
    priceDiffReason?: string;
    remark?: string;
  }[];
}

/** 单条用例结果 */
export interface BatchTestCaseResult {
  recordId: string;
  input: {
    country: string;
    postalCode: string;
    weight: number;
    length: number;
    width: number;
    height: number;
    category: string;
    packagingType: string;
  };
  status: 'ok' | 'error';
  errorMsg?: string;
  returnedCount: number;
  returnedItems: BatchTestReturnedItem[];
  unmatchedExpectations: BatchTestExpectation[];
  /** 所有原始期望（含备注），供前端直接读取 */
  allExpectations: BatchTestExpectation[];
}

/** 批量测试汇总 */
export interface BatchTestSummary {
  totalCases: number;
  totalExpectations: number;
  totalReturnedRoutes: number;
  matchedCount: number;
  matchRate: number;
  missedCount: number;
  missedRate: number;
  priceConsistentCount: number;
  priceConsistentRate: number;
  caliberMismatchCount: number;
  avgPriceDiff: number;
  avgPriceDiffRate: number;
  top1HitCount: number;
  top1HitRate: number;
  errorCount: number;
}

/** 批量测试运行响应 */
export interface BatchTestRunResponse {
  summary: BatchTestSummary;
  details: BatchTestCaseResult[];
}
