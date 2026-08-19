import React, { useState, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { runBatchTest } from '@client/src/api/batch-test';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  BatchTestCase,
  BatchTestRunResponse,
  BatchTestSummary,
  BatchTestCaseResult,
} from '@shared/batch-test.interface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Upload, FileSpreadsheet, Play, Loader2, ChevronDown, Download } from 'lucide-react';

const CHUNK_SIZE = 10;
const MAX_RETRIES = 2;

/** 货代名称映射（Excel名称 → 数据库名称，与后端保持一致） */
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

/** 前端公司匹配逻辑（与后端 matchCompany 保持一致，仅精确匹配+映射表，不做模糊匹配） */
function matchCompany(excelName: string, systemName: string | null): boolean {
  if (!systemName) return false;
  const a = excelName.trim();
  const b = systemName.trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const fwd = FORWARDER_NAME_MAP[a];
  if (fwd && fwd === b) return true;
  for (const [k, v] of Object.entries(FORWARDER_NAME_MAP)) {
    if (v === a && k === b) return true;
  }
  return false;
}

/** 按表头名映射列索引 */
function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = String(h || '').trim();
    if (key) map[key] = i;
  });
  return map;
}

/** 解析 Excel，按记录ID分组 */
function parseExcel(file: File): Promise<BatchTestCase[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        // 优先找"询价数据_整理后"，否则取第一个 sheet
        const sheetName =
          wb.SheetNames.find((n) => n.includes('询价')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          blankrows: false,
          defval: '',
        });
        if (rows.length < 2) {
          reject(new Error('Excel 内容为空'));
          return;
        }
        const headers = (rows[0] as string[]).map((c) => String(c || '').trim());
        const col = buildColumnMap(headers);
        const required = ['记录ID', '产品属性', '目的地国家', '邮编', '包装总重量kg', '包装长cm', '包装宽cm', '包装高cm', '包装类型'];
        const missing = required.filter((k) => !(k in col));
        if (missing.length > 0) {
          reject(new Error(`Excel 缺少必要列: ${missing.join(', ')}`));
          return;
        }

        const groupMap = new Map<string, BatchTestCase>();
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r] as unknown[];
          const rid = String(row[col['记录ID']] || '').trim();
          if (!rid) continue;

          if (!groupMap.has(rid)) {
            groupMap.set(rid, {
              recordId: rid,
              category: String(row[col['产品属性']] || '').trim(),
              country: String(row[col['目的地国家']] || '').trim().replace(/\s/g, ''),
              postalCode: String(row[col['邮编']] || '').trim(),
              weight: Number(row[col['包装总重量kg']]) || 0,
              length: Number(row[col['包装长cm']]) || 0,
              width: Number(row[col['包装宽cm']]) || 0,
              height: Number(row[col['包装高cm']]) || 0,
              packagingType: String(row[col['包装类型']] || '').trim(),
              expectations: [],
            });
          }

          const company = String(row[col['公司名称']] || '').trim();
          if (company) {
            groupMap.get(rid)!.expectations.push({
              company,
              channelType: String(row[col['货运方式']] || '未知').trim(),
              expectedPrice: Number(row[col['报价']]) || 0,
              deliveryTime: String(row[col['时效']] || '').trim(),
              remark: String(row[col['备注']] || '').trim(),
            });
          }
        }
        resolve(Array.from(groupMap.values()));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** 导出测试结果为 Excel（3 个 sheet：汇总指标 / 明细 / 漏匹配清单） */
function exportToExcel(
  result: BatchTestRunResponse,
  summary: BatchTestSummary,
  fileName: string,
  details?: BatchTestCaseResult[],
) {
  const wb = XLSX.utils.book_new();
  const exportDetails = details || result.details;

  // Sheet 1: 汇总指标
  const summaryData = [
    ['指标', '数值', '说明'],
    ['总用例数', summary.totalCases, '按记录ID去重后的测试用例数量'],
    ['总期望报价数', summary.totalExpectations, '所有用例的期望报价总条数'],
    ['返回路线总数', summary.totalReturnedRoutes, '系统返回的路线总条数'],
    ['已匹配期望数', summary.matchedCount, '期望(公司+货运方式)在返回路线中找到匹配的数量'],
    ['未匹配期望数', summary.missedCount, '期望在返回路线中未找到的数量'],
    ['匹配率', pct(summary.matchRate), '已匹配期望数 / 总期望数'],
    ['漏匹配率', pct(summary.missedRate), '未匹配期望数 / 总期望数'],
    ['价格一致期望数', summary.priceConsistentCount, '已匹配期望中价差在容差内的数量'],
    ['价格一致率', pct(summary.priceConsistentRate), '价格一致期望数 / (已匹配期望数 - 口径不一致数)'],
    ['口径不一致数', summary.caliberMismatchCount || 0, '系统仅含基础运费且附加费为空，价格差异属口径不一致'],
    ['平均价格差异率', pct(summary.avgPriceDiffRate), '每个已匹配期望取最小|系统报价-期望报价|/期望报价，再平均'],
    ['Top-1命中数', summary.top1HitCount, '综合推荐项的货代在期望列表中的用例数'],
    ['Top-1命中率', pct(summary.top1HitRate), 'Top-1命中数 / 有效用例数（排除error）'],
    ['询价错误数', summary.errorCount, '调用询价API报错的用例数'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, ws1, '汇总指标');

  // Sheet 2: 明细（每行 = 一条返回路线）
  const detailHeader = [
    '记录ID', '国家', '邮编', '重量(kg)', '长(cm)', '宽(cm)', '高(cm)',
    '产品属性', '包装类型', '序号', '公司', '货运方式', '系统报价(¥)',
    '期望公司', '期望货运方式', '期望报价(¥)', '价格差异(¥)', '价格差异率',
    '是否一致', '标签', '路线名称', '计费过程', '备注',
  ];
  const detailRows: (string | number)[][] = [detailHeader];
  for (const d of exportDetails) {
    if (d.status === 'error') {
      detailRows.push([
        d.recordId, d.input.country, d.input.postalCode, d.input.weight,
        d.input.length, d.input.width, d.input.height,
        d.input.category, d.input.packagingType,
        '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '询价错误: ' + (d.errorMsg || ''), '', '',
      ]);
      continue;
    }
    d.returnedItems.forEach((item, idx) => {
      const m = item.matchedExpectations[0];
      const hasMultiple = item.matchedExpectations.length > 1;
      const diff = m ? m.priceDiff : null;
      const diffRate = m && m.expectedPrice > 0 ? diff! / m.expectedPrice : null;
      const tolerance = m ? Math.max(m.expectedPrice * 0.05, 50) : 0;
      const consistent = m ? (Math.abs(diff!) <= tolerance ? '是' : m.priceDiffReason === 'possible_caliber_mismatch' ? '口径不一致' : '否') : '-';
      detailRows.push([
        d.recordId, d.input.country, d.input.postalCode, d.input.weight,
        d.input.length, d.input.width, d.input.height,
        d.input.category, d.input.packagingType,
        idx + 1, item.providerName || '-', item.channelTypeLabel,
        Number(item.totalPrice.toFixed(0)),
        m ? m.company : '-',
        m ? m.channelType : '-',
        m ? Number(m.expectedPrice.toFixed(0)) : '-',
        diff !== null ? Number(diff.toFixed(0)) : '-',
        diffRate !== null ? pct(diffRate) : '-',
        consistent,
        item.tag || '-',
        item.routeName || '-',
        item.billingFormula ? item.billingFormula.join('\n') : '',
        m?.remark || '',
      ]);
      // 如果有多条匹配，追加额外行显示
      if (hasMultiple) {
        for (let mi = 1; mi < item.matchedExpectations.length; mi++) {
          const mm = item.matchedExpectations[mi];
          const mmDiff = mm.priceDiff;
          const mmRate = mm.expectedPrice > 0 ? mmDiff / mm.expectedPrice : 0;
          const mmTol = Math.max(mm.expectedPrice * 0.05, 50);
          detailRows.push([
            '', '', '', '', '', '', '', '', '',
            '', '(续)', '',
            '', mm.company, mm.channelType, Number(mm.expectedPrice.toFixed(0)),
            Number(mmDiff.toFixed(0)), pct(mmRate),
            Math.abs(mmDiff) <= mmTol ? '是' : mm.priceDiffReason === 'possible_caliber_mismatch' ? '口径不一致' : '否', '', '', '', mm.remark || '',
          ]);
        }
      }
    });
  }
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2['!cols'] = [
    { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 9 }, { wch: 7 }, { wch: 7 }, { wch: 7 },
    { wch: 8 }, { wch: 10 }, { wch: 5 }, { wch: 14 }, { wch: 7 }, { wch: 12 },
    { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 7 }, { wch: 10 }, { wch: 30 }, { wch: 60 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '明细');

  // Sheet 3: 漏匹配清单
  const missHeader = ['记录ID', '国家', '邮编', '重量(kg)', '产品属性', '期望公司', '期望货运方式', '期望报价(¥)', '期望时效'];
  const missRows: (string | number)[][] = [missHeader];
  for (const d of exportDetails) {
    for (const exp of d.unmatchedExpectations) {
      missRows.push([
        d.recordId, d.input.country, d.input.postalCode, d.input.weight,
        d.input.category, exp.company, exp.channelType,
        exp.expectedPrice, exp.deliveryTime || '-',
      ]);
    }
  }
  const ws3 = XLSX.utils.aoa_to_sheet(missRows);
  ws3['!cols'] = [
    { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 9 }, { wch: 8 },
    { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, '漏匹配清单');

  XLSX.writeFile(wb, fileName);
}

function SummaryCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : tone === 'destructive'
          ? 'text-red-600'
          : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const BatchTestPage = () => {
  const [cases, setCases] = useState<BatchTestCase[]>([]);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [result, setResult] = useState<BatchTestRunResponse | null>(null);
  const [error, setError] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('__ALL__');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setResult(null);
    setProgress(0);
    try {
      const parsed = await parseExcel(file);
      setCases(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCases([]);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleRun = async () => {
    if (cases.length === 0) return;
    setRunning(true);
    setError('');
    setResult(null);
    setProgress(0);

    const allDetails: BatchTestCaseResult[] = [];
    const summary: BatchTestSummary = {
      totalCases: cases.length,
      totalExpectations: 0,
      totalReturnedRoutes: 0,
      matchedCount: 0,
      missedCount: 0,
      priceConsistentCount: 0,
      caliberMismatchCount: 0,
      top1HitCount: 0,
      errorCount: 0,
      matchRate: 0,
      missedRate: 0,
      priceConsistentRate: 0,
      avgPriceDiff: 0,
      avgPriceDiffRate: 0,
      top1HitRate: 0,
    };

    try {
      const totalChunks = Math.ceil(cases.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunk = cases.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        setProgressLabel(`第 ${i + 1}/${totalChunks} 批，每批 ${CHUNK_SIZE} 条…`);

        let resp: BatchTestRunResponse | null = null;
        let lastErr: unknown = null;
        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
          try {
            resp = await runBatchTest({ cases: chunk });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (retry < MAX_RETRIES) {
              setProgressLabel(`第 ${i + 1}/${totalChunks} 批重试中(${retry + 1}/${MAX_RETRIES})…`);
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        }

        if (lastErr && !resp) {
          // 该批全部失败，记录为错误用例，继续下一批
          for (const tc of chunk) {
            allDetails.push({
              recordId: tc.recordId,
              input: {
                country: tc.country,
                postalCode: tc.postalCode,
                weight: tc.weight,
                length: tc.length,
                width: tc.width,
                height: tc.height,
                category: tc.category,
                packagingType: tc.packagingType,
              },
              status: 'error',
              errorMsg: lastErr instanceof Error ? lastErr.message : String(lastErr),
              returnedCount: 0,
              returnedItems: [],
              unmatchedExpectations: tc.expectations,
              allExpectations: tc.expectations,
            });
            summary.errorCount += 1;
            summary.missedCount += tc.expectations.length;
            summary.totalExpectations += tc.expectations.length;
          }
        } else if (resp) {
          allDetails.push(...resp.details);
          const s = resp.summary;
          summary.totalExpectations += s.totalExpectations;
          summary.totalReturnedRoutes += s.totalReturnedRoutes;
          summary.matchedCount += s.matchedCount;
          summary.missedCount += s.missedCount;
          summary.priceConsistentCount += s.priceConsistentCount;
          summary.caliberMismatchCount += s.caliberMismatchCount || 0;
          summary.top1HitCount += s.top1HitCount;
          summary.errorCount += s.errorCount;
        }

        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      const expTotal = summary.totalExpectations || 1;
      summary.matchRate = summary.matchedCount / expTotal;
      summary.missedRate = summary.missedCount / expTotal;
      // 价格一致率以已匹配期望数为分母（期望级），排除口径不一致
      const effectiveMatched = summary.matchedCount - summary.caliberMismatchCount;
      summary.priceConsistentRate = effectiveMatched > 0
        ? summary.priceConsistentCount / effectiveMatched
        : 0;
      // 平均价格差异和差异率从 details 重新汇总
      let diffSum = 0;
      let diffRateSum = 0;
      let diffCnt = 0;
      // 差异率：每个期望取最小差异率，再平均（期望级）
      const expMinRates = new Map<number, number>(); // expectationIndex → min rate
      for (const d of allDetails) {
        expMinRates.clear();
        for (const item of d.returnedItems) {
          for (const m of item.matchedExpectations) {
            const rate = m.expectedPrice > 0 ? Math.abs(m.priceDiff) / m.expectedPrice : 0;
            const prev = expMinRates.get(m.expectationIndex);
            if (prev === undefined || rate < prev) {
              expMinRates.set(m.expectationIndex, rate);
            }
            diffSum += Math.abs(m.priceDiff);
            diffCnt++;
          }
        }
        for (const rate of expMinRates.values()) {
          diffRateSum += rate;
        }
      }
      const matchedExpCount = [...allDetails].reduce((n, d) => {
        const set = new Set<number>();
        for (const item of d.returnedItems) {
          for (const m of item.matchedExpectations) set.add(m.expectationIndex);
        }
        return n + set.size;
      }, 0);
      summary.avgPriceDiff = diffCnt > 0 ? diffSum / diffCnt : 0;
      summary.avgPriceDiffRate = matchedExpCount > 0 ? diffRateSum / matchedExpCount : 0;
      // Top-1 命中率分母排除 error 用例
      const validCases = summary.totalCases - summary.errorCount;
      summary.top1HitRate =
        validCases > 0 ? summary.top1HitCount / validCases : 0;

      // 将原始 cases 中的 remark 补充到 details（防止后端未返回 allExpectations）
      const casesByRid = new Map(cases.map((c) => [c.recordId, c]));
      for (const d of allDetails) {
        const originalCase = casesByRid.get(d.recordId);
        if (originalCase && originalCase.expectations.length > 0) {
          d.allExpectations = originalCase.expectations;
        }
      }

      setResult({ summary, details: allDetails });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgressLabel('');
    }
  };

  // 提取所有涉及的公司名（返回路线 + 期望报价）
  const allCompanies = useMemo(() => {
    if (!result) return [];
    const set = new Set<string>();
    for (const d of result.details) {
      for (const item of d.returnedItems) {
        if (item.providerName) set.add(item.providerName);
      }
      for (const exp of d.unmatchedExpectations) {
        set.add(exp.company);
      }
    }
    return Array.from(set).sort();
  }, [result]);

  // 按公司筛选后的明细
  const filteredDetails = useMemo(() => {
    if (!result || companyFilter === '__ALL__') return result?.details || [];
    return (result?.details || []).filter((d) => {
      // 用例的返回路线或期望中包含该公司即为命中（使用 matchCompany 模糊匹配）
      const inReturned = d.returnedItems.some((i) => matchCompany(companyFilter, i.providerName));
      const inUnmatched = d.unmatchedExpectations.some((e) => e.company && matchCompany(e.company, companyFilter));
      const inMatched = d.returnedItems.some(
        (i) => i.matchedExpectations.some((e) => e.company && matchCompany(e.company, companyFilter)),
      );
      return inReturned || inUnmatched || inMatched;
    });
  }, [result, companyFilter]);

  // 按筛选结果动态重算汇总
  const filteredSummary = useMemo(() => {
    const details = companyFilter === '__ALL__' ? (result?.details || []) : filteredDetails;
    const s: BatchTestSummary = {
      totalCases: details.length,
      totalExpectations: 0,
      totalReturnedRoutes: 0,
      matchedCount: 0,
      missedCount: 0,
      priceConsistentCount: 0,
      caliberMismatchCount: 0,
      top1HitCount: 0,
      errorCount: 0,
      matchRate: 0,
      missedRate: 0,
      priceConsistentRate: 0,
      avgPriceDiff: 0,
      avgPriceDiffRate: 0,
      top1HitRate: 0,
    };
    let diffSum = 0;
    let diffCnt = 0; // 匹配对数（用于avgPriceDiff分母）
    let diffRateSum = 0; // 每个期望取最小差异率后累加
    let matchedExpForRate = 0; // 有匹配的期望数（差异率分母）

    for (const d of details) {
      if (d.status === 'error') {
        s.errorCount++;
        const errExps = companyFilter === '__ALL__'
          ? d.unmatchedExpectations.length
          : d.unmatchedExpectations.filter((e) => e.company && matchCompany(e.company, companyFilter)).length;
        s.totalExpectations += errExps;
        s.missedCount += errExps;
        continue;
      }

      // 收集该用例中所有匹配对（按公司筛选）
      const allMatchedExps = new Set<string>(); // 去重：同一期望只算一次
      const expConsistentSet = new Set<string>(); // 价格一致的期望
      const expHasNonCaliberSet = new Set<string>(); // 至少一条匹配非口径不一致的期望
      const expMinRateMap = new Map<string, number>(); // 期望key → 最小差异率
      let pairDiffSum = 0;
      let pairCnt = 0;
      let returnedRoutesForCompany = 0;

      for (const item of d.returnedItems) {
        // 筛选公司时，返回路线只计该公司（使用 matchCompany 模糊匹配）
        if (companyFilter !== '__ALL__' && matchCompany(companyFilter, item.providerName)) {
          returnedRoutesForCompany++;
        }

        const relevantMatches = companyFilter === '__ALL__'
          ? item.matchedExpectations
          : item.matchedExpectations.filter((e) => e.company && matchCompany(e.company, companyFilter));
        for (const m of relevantMatches) {
          // 去重 key：用 expectationIndex（后端传入的期望原始索引，唯一可靠）
          const key = String(m.expectationIndex);
          allMatchedExps.add(key);
          // 价格一致判定（期望级：任一匹配对在容差内就算一致）
          const tolerance = Math.max(m.expectedPrice * 0.05, 50);
          if (Math.abs(m.priceDiff) <= tolerance) {
            expConsistentSet.add(key);
          }
          if (m.priceDiffReason !== 'possible_caliber_mismatch') {
            expHasNonCaliberSet.add(key);
          }
          // 匹配对层面统计（绝对值）
          pairDiffSum += Math.abs(m.priceDiff);
          pairCnt++;
          // 跟踪该期望的最小差异率
          const rate = m.expectedPrice > 0 ? Math.abs(m.priceDiff) / m.expectedPrice : 0;
          const prev = expMinRateMap.get(key);
          if (prev === undefined || rate < prev) {
            expMinRateMap.set(key, rate);
          }
        }
      }

      // 未匹配期望（按公司筛选）
      const unmatchedCount = companyFilter === '__ALL__'
        ? d.unmatchedExpectations.length
        : d.unmatchedExpectations.filter((e) => e.company && matchCompany(e.company, companyFilter)).length;

      // 以期望为单位的计数
      const matchedExpCount = allMatchedExps.size;
      s.matchedCount += matchedExpCount;
      s.missedCount += unmatchedCount;
      s.totalExpectations += matchedExpCount + unmatchedCount;
      // 返回路线：全部时累加全部，筛选时只加该公司路线
      s.totalReturnedRoutes += companyFilter === '__ALL__' ? d.returnedCount : returnedRoutesForCompany;

      // 价格一致以期望为单位
      s.priceConsistentCount += expConsistentSet.size;
      // 口径不一致：已匹配但非一致且所有匹配路线均为口径不一致
      for (const key of allMatchedExps) {
        if (!expConsistentSet.has(key) && !expHasNonCaliberSet.has(key)) {
          s.caliberMismatchCount++;
        }
      }
      diffSum += pairDiffSum;
      diffCnt += pairCnt;
      // 差异率：每个期望取最小差异率
      for (const rate of expMinRateMap.values()) {
        diffRateSum += rate;
        matchedExpForRate++;
      }

      // Top-1：优先取 tag 含"综合推荐"的项，无则 fallback 到第一条；只算 ok 用例
      if (d.returnedItems.length > 0 && d.status === 'ok') {
        const top1 = d.returnedItems.find((it) => it.tag && it.tag.includes('综合推荐')) || d.returnedItems[0];
        const top1Hit = companyFilter === '__ALL__'
          ? top1.matchedExpectations.length > 0
          : top1.matchedExpectations.some((e) => e.company && matchCompany(e.company, companyFilter));
        if (top1Hit) s.top1HitCount++;
      }
    }

    const expTotal = s.totalExpectations || 1;
    s.matchRate = s.matchedCount / expTotal;
    s.missedRate = s.missedCount / expTotal;
    // 价格一致率以已匹配期望数为分母（期望级），排除口径不一致
    const effectiveMatchedS = s.matchedCount - s.caliberMismatchCount;
    s.priceConsistentRate = effectiveMatchedS > 0 ? s.priceConsistentCount / effectiveMatchedS : 0;
    // 平均价格差异（绝对值，匹配对层面）和差异率（期望级最小）
    s.avgPriceDiff = diffCnt > 0 ? diffSum / diffCnt : 0;
    s.avgPriceDiffRate = matchedExpForRate > 0 ? diffRateSum / matchedExpForRate : 0;
    // Top-1 命中率分母排除 error 用例
    const validCases = s.totalCases - s.errorCount;
    s.top1HitRate = validCases > 0 ? s.top1HitCount / validCases : 0;
    return s;
  }, [result, filteredDetails, companyFilter]);

  const s = filteredSummary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">批量测试</h1>
        <p className="text-sm text-muted-foreground mt-1">
          导入询价数据 Excel，批量调用询价 API，将系统返回报价与真实报价逐条对比。
        </p>
      </div>

      {/* 上传区 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">导入测试数据</CardTitle>
          <CardDescription className="text-xs">
            支持 .xlsx 格式，需包含列：记录ID / 产品属性 / 目的地国家 / 邮编 / 包装总重量kg / 包装长cm / 包装宽cm / 包装高cm / 包装类型 / 公司名称 / 货运方式 / 报价 / 时效
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  已解析 {cases.length} 条测试用例（按记录ID去重），{' '}
                  {cases.reduce((sum, c) => sum + c.expectations.length, 0)} 条期望报价
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  点击或拖拽 Excel 文件到此处
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}

          {cases.length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              <Button
                onClick={handleRun}
                disabled={running}
                className="gap-2"
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {running ? '运行中…' : '开始测试'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCases([]);
                  setFileName('');
                  setResult(null);
                  setProgress(0);
                  setCompanyFilter('__ALL__');
                }}
                disabled={running}
              >
                清除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 进度 */}
      {running && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{progressLabel}</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>
      )}

      {/* 汇总 */}
      {s && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">测试结果汇总</h2>
            <div className="flex items-center gap-3">
              <Accordion type="single" collapsible className="w-auto">
                <AccordionItem value="metrics-help" className="border-0">
                  <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-1 px-2">
                    指标说明
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground space-y-2 pt-2 max-w-2xl">
                    <p><strong className="text-foreground">总用例数</strong>：按记录ID去重后的测试用例数量。每个用例包含 1 条输入参数和 N 条期望报价（来自同一记录ID下不同货代）。</p>
                    <p><strong className="text-foreground">匹配率</strong> = 已匹配期望数 / 总期望数。已匹配 = 期望的（公司名+货运方式）在系统返回路线中找到至少一条匹配。多对1：一个期望可匹配多条返回路线，但计数只算 1 次。</p>
                    <p><strong className="text-foreground">漏匹配率</strong> = 未匹配期望数 / 总期望数。未匹配 = 期望的货代+货运方式在系统返回路线中完全没找到。</p>
                    <p><strong className="text-foreground">价格一致率</strong> = 价格一致期望数 / 已匹配期望数。一个期望只要任一匹配对的价差 ≤ max(期望价×5%, ¥50) 就算一致（期望级）。</p>
                    <p><strong className="text-foreground">平均价格差异率</strong> = 每个已匹配期望取其所有匹配对中<strong>最小</strong>的 |系统报价 - 期望报价| / 期望报价，再对所有已匹配期望取平均。多对1下一个期望可匹配多条路线，只取最接近的那条算差异率。</p>
                    <p><strong className="text-foreground">Top-1 命中率</strong> = Top-1 命中数 / 有效用例数。Top-1 = 系统返回路线中 tag 含"综合推荐"的项（无标签则取第一条）；命中 = 该项的货代在期望列表中。分母排除询价错误的用例。</p>
                    <p><strong className="text-foreground">返回路线总数</strong>：系统对所有用例询价返回的路线总条数。筛选公司时只计该公司的路线。</p>
                    <p><strong className="text-foreground">询价错误数</strong>：调用询价 API 报错的用例数，不计入匹配率/漏匹配率/Top-1 的分母（Top-1）。</p>
                    <p className="pt-1 text-muted-foreground/70">注：以上指标在筛选公司时会基于该公司相关的数据动态重算。</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (result) {
                    exportToExcel(result, s, `批量测试结果_${new Date().toISOString().slice(0, 10)}.xlsx`, filteredDetails);
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" />
                导出 Excel
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <SummaryCard label="总用例数" value={String(s.totalCases)} sub={`${s.totalExpectations} 条期望报价`} />
            <SummaryCard
              label="匹配率"
              value={pct(s.matchRate)}
              sub={`${s.matchedCount} / ${s.totalExpectations} 已匹配`}
              tone={s.matchRate >= 0.7 ? 'success' : s.matchRate >= 0.4 ? 'warning' : 'destructive'}
            />
            <SummaryCard
              label="漏匹配率"
              value={pct(s.missedRate)}
              sub={`${s.missedCount} 条期望未找到`}
              tone={s.missedRate <= 0.3 ? 'success' : 'destructive'}
            />
            <SummaryCard
              label="价格一致率"
              value={pct(s.priceConsistentRate)}
              sub={`${s.priceConsistentCount} / ${s.matchedCount - (s.caliberMismatchCount || 0)} 有效匹配期望`}
              tone={s.priceConsistentRate >= 0.7 ? 'success' : 'warning'}
            />
            <SummaryCard
              label="口径不一致数"
              value={String(s.caliberMismatchCount || 0)}
              sub="系统仅含基础运费，附加费为空"
              tone={(s.caliberMismatchCount || 0) === 0 ? 'success' : 'warning'}
            />
            <SummaryCard
              label="平均价格差异率"
              value={pct(s.avgPriceDiffRate)}
              sub="已匹配对的平均 |差/期望价|"
            />
            <SummaryCard
              label="Top-1 命中率"
              value={pct(s.top1HitRate)}
              sub={`${s.top1HitCount} / ${s.totalCases - s.errorCount} 有效用例`}
              tone={s.top1HitRate >= 0.5 ? 'success' : 'warning'}
            />
            <SummaryCard label="返回路线总数" value={String(s.totalReturnedRoutes)} />
            <SummaryCard
              label="询价错误数"
              value={String(s.errorCount)}
              tone={s.errorCount === 0 ? 'success' : 'destructive'}
            />
          </div>
        </div>
      )}

      {/* 明细 */}
      {result && result.details.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">
              用例明细（{filteredDetails.length} 条
              {companyFilter !== '__ALL__' ? ` / 共 ${result.details.length} 条` : ''}）
            </h2>
            {allCompanies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">筛选公司:</span>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-[200px] h-8 text-sm">
                    <SelectValue placeholder="全部公司" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">全部公司</SelectItem>
                    {allCompanies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Accordion type="multiple" className="space-y-2">
            {filteredDetails.map((d) => {
              const hasError = d.status === 'error';
              // 筛选公司时，表格内只显示该公司的行（使用 matchCompany 模糊匹配）
              const visibleItems = companyFilter === '__ALL__'
                ? d.returnedItems
                : d.returnedItems.filter(
                    (i) => matchCompany(companyFilter, i.providerName) ||
                           i.matchedExpectations.some((e) => e.company && matchCompany(e.company, companyFilter)),
                  );
              const visibleUnmatched = companyFilter === '__ALL__'
                ? d.unmatchedExpectations
                : d.unmatchedExpectations.filter((e) => e.company && matchCompany(e.company, companyFilter));
              // 头部统计也跟随筛选：只计当前筛选公司的数据
              const matchedCnt = visibleItems.filter(
                (i) => i.matchedExpectations.length > 0,
              ).length;
              const returnedCnt = companyFilter === '__ALL__' ? d.returnedCount : visibleItems.length;
              // 计算该用例的平均价格差异率（每个期望取最小差异率，再平均）
              const expMinRate = new Map<number, number>(); // expectationIndex → min rate
              for (const item of visibleItems) {
                const relevantMatches = companyFilter === '__ALL__'
                  ? item.matchedExpectations
                  : item.matchedExpectations.filter((e) => e.company && matchCompany(e.company, companyFilter));
                for (const m of relevantMatches) {
                  const rate = m.expectedPrice > 0 ? Math.abs(m.priceDiff) / m.expectedPrice : 0;
                  const prev = expMinRate.get(m.expectationIndex);
                  if (prev === undefined || rate < prev) {
                    expMinRate.set(m.expectationIndex, rate);
                  }
                }
              }
              const avgDiffRate = expMinRate.size > 0
                ? Array.from(expMinRate.values()).reduce((a, b) => a + b, 0) / expMinRate.size
                : null;
              return (
                <AccordionItem
                  key={d.recordId}
                  value={d.recordId}
                  className="border border-border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <span className="text-sm font-mono text-muted-foreground">
                        {d.recordId}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {d.input.country} · {d.input.weight}kg · {d.input.category}
                      </Badge>
                      {hasError ? (
                        <Badge variant="destructive" className="text-xs">错误</Badge>
                      ) : (
                        <>
                          <Badge variant="secondary" className="text-xs">
                            返回 {returnedCnt} 条
                          </Badge>
                          {matchedCnt > 0 && (
                            <Badge className="text-xs bg-emerald-600">
                              匹配 {matchedCnt}
                            </Badge>
                          )}
                          {visibleUnmatched.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              漏 {visibleUnmatched.length}
                            </Badge>
                          )}
                          {avgDiffRate !== null && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                avgDiffRate <= 0.05
                                  ? 'border-emerald-400 text-emerald-600'
                                  : avgDiffRate <= 0.15
                                    ? 'border-amber-400 text-amber-600'
                                    : 'border-red-400 text-red-600'
                              }`}
                            >
                              差异率 {(avgDiffRate * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasError ? (
                      <p className="text-sm text-red-600 py-2">{d.errorMsg}</p>
                    ) : (
                      <div className="space-y-4 py-2">
                        {/* 输入参数 */}
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>邮编: {d.input.postalCode}</span>
                          <span>尺寸: {d.input.length}×{d.input.width}×{d.input.height}cm</span>
                          <span>包装: {d.input.packagingType || '-'}</span>
                        </div>

                        {/* 返回路线表 */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"></TableHead>
                              <TableHead className="w-8">#</TableHead>
                              <TableHead>公司</TableHead>
                              <TableHead className="w-16">方式</TableHead>
                              <TableHead className="w-24">系统报价</TableHead>
                              <TableHead className="w-24">期望报价</TableHead>
                              <TableHead className="w-24">差异</TableHead>
                              <TableHead className="w-20">标签</TableHead>
                              <TableHead>路线名</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleItems.map((item, idx) => {
                              const matches = item.matchedExpectations || [];
                              const firstMatch = matches[0];
                              const hasMultiple = matches.length > 1;
                              const rowKey = `${d.recordId}-${idx}`;
                              const isExpanded = expandedRows.has(rowKey);
                              const hasFormula = item.billingFormula && item.billingFormula.length > 0;
                              // 提前计算备注：直接从 allExpectations 取（最可靠）
                              const allExps = d.allExpectations || [];
                              const allRemarks = allExps
                                .map((e) => e.remark)
                                .filter((r) => r && r.trim().length > 0);
                              const hasRemark = allRemarks.length > 0;
                              const canExpand = hasFormula || hasRemark;
                              return (
                                <>
                                  <React.Fragment key={idx}>
                                  <TableRow
                                    className={matches.length > 0 ? 'bg-emerald-50/50' : ''}
                                  >
                                    <TableCell className="w-8 p-0">
                                      {canExpand && (
                                        <button
                                          onClick={() => toggleRow(rowKey)}
                                          className="flex items-center justify-center w-full h-full p-1 text-muted-foreground hover:text-foreground"
                                        >
                                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                        </button>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium text-sm">
                                      {item.providerName || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {item.channelTypeLabel}
                                    </TableCell>
                                    <TableCell className="text-sm tabular-nums">
                                      ¥{item.totalPrice.toFixed(0)}
                                    </TableCell>
                                    <TableCell className="text-sm tabular-nums">
                                      {firstMatch ? (
                                        <span>
                                          ¥{firstMatch.expectedPrice.toFixed(0)}
                                          {hasMultiple && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                              +{matches.length - 1}
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm tabular-nums">
                                      {firstMatch ? (
                                        <span
                                          className={
                                            Math.abs(firstMatch.priceDiff) <=
                                            Math.max(firstMatch.expectedPrice * 0.05, 50)
                                              ? 'text-emerald-600'
                                              : firstMatch.priceDiffReason === 'possible_caliber_mismatch'
                                                ? 'text-amber-600'
                                                : 'text-red-600'
                                          }
                                          title={firstMatch.priceDiffReason === 'possible_caliber_mismatch' ? '系统报价仅含基础运费，附加费字段为空' : undefined}
                                        >
                                          {firstMatch.priceDiff > 0 ? '+' : ''}{firstMatch.priceDiff.toFixed(0)}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {item.tag && (
                                        <Badge variant="outline" className="text-xs">
                                          {item.tag}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                      {item.routeName}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && canExpand && (
                                    <TableRow className="bg-accent/30">
                                      <TableCell colSpan={9} className="py-3 px-6">
                                        <div className="flex gap-4">
                                          {hasFormula && (
                                            <div className="flex-1 min-w-0">
                                              <span className="text-[10px] font-medium text-muted-foreground mb-1.5 block">计费过程</span>
                                              <div className="bg-background rounded-sm p-2.5 space-y-0.5 border border-border/50">
                                                {item.billingFormula!.map((line: string, fi: number) => (
                                                  <p
                                                    key={fi}
                                                    className={`text-[11px] leading-relaxed tabular-nums ${
                                                      line.startsWith('【') ? 'font-semibold text-foreground mt-1.5 first:mt-0' : line.startsWith('  ') ? 'text-muted-foreground pl-3' : 'text-foreground'
                                                    }`}
                                                    style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}
                                                  >
                                                    {line}
                                                  </p>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {hasRemark && (
                                            <div className="flex-1 min-w-0">
                                              <span className="text-[10px] font-medium text-muted-foreground mb-1.5 block">备注</span>
                                              <div className="bg-background rounded-sm p-2.5 border border-border/50 space-y-1.5">
                                                {allRemarks.map((r, ri) => (
                                                  <p key={ri} className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-all">
                                                    {r}
                                                  </p>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  </React.Fragment>
                                </>
                              );
                            })}
                          </TableBody>
                        </Table>

                        {/* 漏匹配期望 */}
                        {visibleUnmatched.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-red-600">
                              期望有但系统未返回的货代（{visibleUnmatched.length} 条）:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {visibleUnmatched.map((exp, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs border-red-300 text-red-600"
                                >
                                  {exp.company} · {exp.channelType} · ¥{exp.expectedPrice}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}
    </div>
  );
};

export default BatchTestPage;
