import { Injectable, Logger } from '@nestjs/common';
import { LogisticsInquiryService } from '../logistics-inquiry/logistics-inquiry.service';
import type {
  InquiryRequest,
  InquiryResponse,
  InquiryResultItem,
  ChannelType,
} from '@shared/api.interface';
import type {
  BatchTestCase,
  BatchTestExpectation,
  BatchTestRunRequest,
  BatchTestRunResponse,
  BatchTestCaseResult,
  BatchTestReturnedItem,
  BatchTestSummary,
} from '@shared/batch-test.interface';

/** 货代名称映射（Excel名称 → 数据库名称，仅非精确匹配的需要映射） */
const FORWARDER_NAME_MAP: Record<string, string> = {
  '示例货代G': '示例货代G国际',
  '示例货代F': '示例货代F国际',
  '深圳示例货代E': '示例货代E',
  '深圳示例货代J': '示例货代J',
  '深圳示例货代K': '示例货代K',
  '示例货代A': '示例货代A国际',
  '示例货代L': '广州示例货代L',
  '示例货代M': '示例货代M',
  '示例货代N': '示例货代N国际',
};

/** Excel 货运方式 → 系统 channelType */
const CHANNEL_TYPE_MAP: Record<string, ChannelType> = {
  '空运': 'air',
  '空派': 'air',
  '海运': 'sea',
  '海派': 'sea',
  '陆运': 'land',
};

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  air: '空运',
  sea: '海运',
  land: '陆运',
  warehouse: '仓内',
};

/** 价格容差：差异 ≤ max(期望价 × 5%, 50元) 视为一致 */
function isPriceConsistent(systemPrice: number, expectedPrice: number): boolean {
  const diff = Math.abs(systemPrice - expectedPrice);
  const tolerance = Math.max(expectedPrice * 0.05, 50);
  return diff <= tolerance;
}

/** 公司名精确匹配（含映射表查找，不做模糊匹配） */
function matchCompany(excelName: string, systemName: string | null): boolean {
  if (!systemName) return false;
  const a = excelName.trim();
  const b = systemName.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  // 映射表精确匹配
  const fwd = FORWARDER_NAME_MAP[a];
  if (fwd && fwd === b) return true;
  // 反向匹配
  for (const [k, v] of Object.entries(FORWARDER_NAME_MAP)) {
    if (v === a && k === b) return true;
  }
  return false;
}

/** 将 Excel 货运方式映射为系统 channelType，"未知"返回 null（不约束） */
function resolveChannelType(raw: string): ChannelType | null {
  const s = (raw || '').trim();
  if (!s || s === '未知') return null;
  return CHANNEL_TYPE_MAP[s] || null;
}

@Injectable()
export class LogisticsBatchTestService {
  private readonly logger = new Logger(LogisticsBatchTestService.name);

  constructor(
    private readonly inquiryService: LogisticsInquiryService,
  ) {}

  async run(request: BatchTestRunRequest): Promise<BatchTestRunResponse> {
    const cases: BatchTestCase[] = request.cases || [];
    const details: BatchTestCaseResult[] = [];
    const summary: BatchTestSummary = {
      totalCases: cases.length,
      totalExpectations: 0,
      totalReturnedRoutes: 0,
      matchedCount: 0,
      matchRate: 0,
      missedCount: 0,
      missedRate: 0,
      priceConsistentCount: 0,
      priceConsistentRate: 0,
      caliberMismatchCount: 0,
      avgPriceDiff: 0,
      avgPriceDiffRate: 0,
      top1HitCount: 0,
      top1HitRate: 0,
      errorCount: 0,
    };

    let priceDiffSum = 0;
    let priceDiffCount = 0;
    let priceDiffRateSum = 0; // 每个期望取最小差异率后累加
    let matchedExpForRate = 0; // 有匹配的期望数（差异率分母）

    for (const tc of cases) {
      const expectations: BatchTestExpectation[] = Array.isArray(tc?.expectations) ? tc.expectations : [];
      summary.totalExpectations += expectations.length;

      const input = {
        country: tc.country,
        postalCode: tc.postalCode,
        weight: tc.weight,
        length: tc.length,
        width: tc.width,
        height: tc.height,
        category: tc.category,
        packagingType: tc.packagingType,
      };

      const inquiryRequest: InquiryRequest = {
        country: (tc.country || '').trim(),
        city: '',
        postalCode: String(tc.postalCode || '').trim(),
        weight: Number(tc.weight) || 0,
        length: Number(tc.length) || 0,
        width: Number(tc.width) || 0,
        height: Number(tc.height) || 0,
        quantity: 1,
        packagesCount: 1,
        category: (tc.category || '').trim(),
        packagingType: (tc.packagingType || '').trim(),
        declaredValue: 0,
        expectedDays: 0,
        maxResults: 500,
      };

      try {
        const response: InquiryResponse | null | undefined = await this.inquiryService.inquire(inquiryRequest);
        const items: InquiryResultItem[] = response?.items || [];
        summary.totalReturnedRoutes += items.length;

        // Top-1 命中：优先取 tag 含"综合推荐"的项，无则 fallback 到 items[0]
        if (items.length > 0) {
          const top1Item = items.find((it) => it.tag && it.tag.includes('综合推荐')) || items[0];
          const top1Hit = expectations.some((exp: BatchTestExpectation) =>
            matchCompany(exp.company, top1Item.providerName),
          );
          if (top1Hit) summary.top1HitCount++;
        }

        // 匹配：对每个期望，在返回 items 中找所有匹配项（多对1，一个期望可匹配多条返回路线）
        const itemMatchMap = new Map<number, { expectation: BatchTestExpectation; diff: number; expIdx: number; priceDiffReason?: string }[]>();

        for (let expIdx = 0; expIdx < expectations.length; expIdx++) {
          const exp = expectations[expIdx];
          const targetChannel = resolveChannelType(exp.channelType);
          let matchedAny = false;
          let expConsistent = false;
          let expMinDiffRate = Infinity;
          let expCaliberMismatch = true;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!matchCompany(exp.company, item.providerName)) continue;
            if (targetChannel !== null && item.channelType !== targetChannel) continue;
            matchedAny = true;
            const systemPrice = item.totalPrice ?? 0;
            const diff = systemPrice - exp.expectedPrice;
            const consistent = isPriceConsistent(systemPrice, exp.expectedPrice);
            const isCaliberMismatch = !consistent && diff < 0 && exp.expectedPrice > 0 && Math.abs(diff) / exp.expectedPrice > 0.20;
            if (!isCaliberMismatch) expCaliberMismatch = false;
            if (consistent) expConsistent = true;
            if (!itemMatchMap.has(i)) itemMatchMap.set(i, []);
            itemMatchMap.get(i)!.push({ expectation: exp, diff, expIdx, priceDiffReason: isCaliberMismatch ? 'possible_caliber_mismatch' : undefined });
            priceDiffSum += Math.abs(diff);
            priceDiffCount++;
            const rate = exp.expectedPrice > 0 ? Math.abs(diff) / exp.expectedPrice : 0;
            if (rate < expMinDiffRate) expMinDiffRate = rate;
          }
          if (matchedAny) {
            summary.matchedCount++;
            if (expConsistent) summary.priceConsistentCount++;
            if (expCaliberMismatch && !expConsistent) summary.caliberMismatchCount++;
            if (expMinDiffRate !== Infinity) {
              priceDiffRateSum += expMinDiffRate;
              matchedExpForRate++;
            }
          } else {
            summary.missedCount++;
          }
        }

        // 构建返回 items 列表
        const returnedItems: BatchTestReturnedItem[] = items.map((item: InquiryResultItem, idx: number) => {
          const matches = itemMatchMap.get(idx) || [];
          return {
            providerName: item.providerName,
            channelType: item.channelType,
            channelTypeLabel: item.channelType
              ? CHANNEL_TYPE_LABEL[item.channelType] || item.channelType
              : '-',
            routeName: item.routeName,
            totalPrice: item.totalPrice,
            tag: item.tag,
            minDeliveryDays: item.minDeliveryDays,
            maxDeliveryDays: item.maxDeliveryDays,
            billingFormula: item.billingFormula,
            priceDetail: item.priceDetail,
            matchedExpectations: matches.map((m) => ({
              company: m.expectation.company,
              channelType: m.expectation.channelType,
              expectedPrice: m.expectation.expectedPrice,
              deliveryTime: m.expectation.deliveryTime,
              priceDiff: m.diff,
              expectationIndex: m.expIdx,
              priceDiffReason: m.priceDiffReason,
              remark: m.expectation.remark,
            })),
          };
        });

        // 未匹配期望 = 期望列表中未被任何返回 item 匹配的条目
        const matchedExpectationRefs = new Set(
          Array.from(itemMatchMap.values()).flat().map((v) => v.expectation),
        );
        const trulyUnmatched = expectations.filter(
          (exp: BatchTestExpectation) => !matchedExpectationRefs.has(exp),
        );

        details.push({
          recordId: tc.recordId,
          input,
          status: 'ok',
          returnedCount: items.length,
          returnedItems,
          unmatchedExpectations: trulyUnmatched,
          allExpectations: expectations,
        });
      } catch (e) {
        summary.errorCount++;
        const errMsg = e instanceof Error ? e.message : String(e);
        this.logger.error(`用例 ${tc.recordId} 询价失败: ${errMsg}`);
        details.push({
          recordId: tc.recordId,
          input,
          status: 'error',
          errorMsg: errMsg,
          returnedCount: 0,
          returnedItems: [],
          unmatchedExpectations: expectations,
          allExpectations: expectations,
        });
        summary.missedCount += expectations.length;
      }
    }

    try {
      // 计算比率
      const expTotal = summary.totalExpectations || 1;
      summary.matchRate = summary.matchedCount / expTotal;
      summary.missedRate = summary.missedCount / expTotal;
      const effectiveMatchedCount = summary.matchedCount - summary.caliberMismatchCount;
      summary.priceConsistentRate =
        effectiveMatchedCount > 0
          ? summary.priceConsistentCount / effectiveMatchedCount
          : 0;
      summary.avgPriceDiff = priceDiffCount > 0 ? priceDiffSum / priceDiffCount : 0;
      summary.avgPriceDiffRate = matchedExpForRate > 0 ? priceDiffRateSum / matchedExpForRate : 0;
      const validCases = summary.totalCases - summary.errorCount;
      summary.top1HitRate =
        validCases > 0 ? summary.top1HitCount / validCases : 0;
    } catch (e) {
      this.logger.error(
        `批量测试汇总计算失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    this.logger.log(
      `批量测试完成: ${summary.totalCases} 用例, ` +
      `匹配 ${summary.matchedCount}/${summary.totalExpectations} (${(summary.matchRate * 100).toFixed(1)}%), ` +
      `价格一致 ${summary.priceConsistentCount}, 口径不一致 ${summary.caliberMismatchCount}, ` +
      `Top-1 命中 ${summary.top1HitCount}/${summary.totalCases}`,
    );

    return { summary, details };
  }
}
