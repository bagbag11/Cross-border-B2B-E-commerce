import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { logisticsRoute, pricingRule, freightForwarderCoopCount, forwarderSupplierPayment } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';
import type {
  InquiryRequest,
  InquiryResponse,
  InquiryResultItem,
  InquiryPriceDetail,
  ChannelType,
  TransportType,
  CombinedRouteInfo,
  SurchargeItem,
} from '@shared/api.interface';

type BillingMode = 'first_weight_50g' | 'first_weight_500g' | 'first_weight_1kg' | 'step_unit' | 'per_item_per_kg' | 'per_kg' | 'per_ticket' | 'range_price';

const FORWARDER_NAME_MAP: Record<string, string> = {
  '示例货代A国际': '示例货代A',
  '示例货代B': '上海示例货代B',
  '示例货代C': '示例货代C韩国专线',
  '示例货代D': '示例货代D非洲专线',
  '示例货代E': '深圳示例货代E',
  '示例货代F': '示例货代F非洲专线',
  '示例货代G': '武汉示例货代G',
  '示例平台物流': '示例平台官方物流',
  '示例货代H': '示例货代H国际物流',
  '示例货代I': '示例货代I物流',
};

const CURRENCY_RATES: Record<string, number> = {
  CNY: 1,
  RMB: 1,
  USD: 6.8,
  KRW: 0.0047,
  AED: 1.84,
};

type BillingUnit = 'kg' | 'cbm' | 'ticket' | 'pallet' | 'container' | 'piece' | 'unknown';

function parseBillingUnit(unitStr: string | null): { unit: BillingUnit; currency: string; stepSize?: number } {
  const s: string = (unitStr || '').trim().toUpperCase();
  if (!s || s === 'NULL') return { unit: 'unknown', currency: '' };
  let currency: string = '';
  if (s.includes('USD') || s.includes('$')) currency = 'USD';
  else if (s.includes('AED')) currency = 'AED';
  else if (s.includes('KRW')) currency = 'KRW';
  else if (s.includes('CNY') || s.includes('RMB') || s.includes('元') || s.includes('¥')) currency = 'CNY';
  let unit: BillingUnit = 'unknown';
  if (s.includes('CBM') || s.includes('M3') || s.includes('立方')) unit = 'cbm';
  else if (s.includes('票') || s.includes('件') || s.includes('TICKET') || s.includes('SHIPMENT')) unit = 'ticket';
  else if (s.includes('GP') || s.includes('HQ') || s.includes('CONTAINER') || s.includes('柜')) unit = 'container';
  else if (s.includes('KG') || s.includes('公斤') || s.includes('千克')) unit = 'kg';
  else if (s.includes('PALLET') || s.includes('托盘')) unit = 'pallet';
  let stepSize: number | undefined;
  if (unit === 'kg') {
    const m = s.match(/\/(\d+(?:\.\d+)?)\s*(?:KG|公斤|千克)/);
    if (m) stepSize = parseFloat(m[1]);
  }
  return { unit, currency, stepSize };
}

function getRuleCurrencyRate(unitPriceUnit: string | null, routeCurrency: string | null): number {
  const { currency } = parseBillingUnit(unitPriceUnit);
  if (currency && CURRENCY_RATES[currency]) return CURRENCY_RATES[currency];
  return CURRENCY_RATES[routeCurrency || 'CNY'] ?? 1;
}

const ALL_BILLING_MODES: BillingMode[] = ['first_weight_500g', 'first_weight_1kg', 'per_kg', 'first_weight_50g', 'step_unit'];

function normalizeBillingMode(raw: unknown): 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume' | 'ticket' {
  if (raw == null || raw === '') return 'volumetric_weight';
  const s = String(raw).trim();
  if (!s) return 'volumetric_weight';
  const lower = s.toLowerCase();
  if (lower === 'cbm' || lower === '体积计费' || lower === 'volume' || lower === '按体积' || lower === 'by_volume') return 'volume';
  if (lower === 'max_both' || lower === '按体积重与实重取大' || lower === '取大' || lower === '实重与体积重取大' || lower === '实重与体积重取大计费') return 'max_both';
  if (lower === 'actual_weight' || lower === '按实重' || lower === '实重计费') return 'actual_weight';
  if (lower === 'volumetric_weight' || lower === '按体积重' || lower === '体积重计费') return 'volumetric_weight';
  if (lower === '按方' || lower === '按体积' || lower === 'by_volume') return 'volume';
  if (lower === '按公斤' || lower === '按实重') return 'actual_weight';
  if (lower === '按密度计费' || lower === '密度计费') return 'max_both';
  if (lower === '按票计费' || lower === '按件计费') return 'ticket';
  return 'volumetric_weight';
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  double_clearance_tax_door: '双清包税到门',
  double_clearance_tax: '双清包税',
  ddp: '包税(DDP)',
  ddu: '自税(DDU)',
  dap: '自税(DAP)',
  deferred: '自税递延',
  pva: '递延(PVA)',
  acp: 'ACP逆算',
  reverse_calc: '包逆算',
  customer_clearance: '客户自行清关',
  customer_pickup: '客户自行提货',
  platform_warehouse: '平台送仓',
  standard: '标准服务',
  unknown: '服务类型未知',
};

function normalizeServiceType(raw: string | null | undefined): { type: string; label: string; isDoubleClearance: boolean } {
  if (!raw) return { type: 'unknown', label: SERVICE_TYPE_LABELS.unknown, isDoubleClearance: false };
  const s: string = String(raw).trim().toLowerCase();
  if (s.includes('双清包税到门') || s === 'double_clearance_tax_door') {
    return { type: 'double_clearance_tax_door', label: '双清包税到门', isDoubleClearance: true };
  }
  if (s.includes('双清包税')) {
    return { type: 'double_clearance_tax', label: '双清包税', isDoubleClearance: true };
  }
  if (s.includes('包税') && s.includes('ddp')) {
    return { type: 'ddp', label: '包税(DDP)', isDoubleClearance: true };
  }
  if (s.includes('包税')) {
    return { type: 'ddp', label: '包税', isDoubleClearance: true };
  }
  if (s.includes('自税') && s.includes('递延')) {
    return { type: 'deferred', label: '自税递延', isDoubleClearance: false };
  }
  if (s.includes('递延') && s.includes('pva')) {
    return { type: 'pva', label: '递延(PVA)', isDoubleClearance: false };
  }
  if (s.includes('递延')) {
    return { type: 'deferred', label: '递延', isDoubleClearance: false };
  }
  if (s.includes('自税') && s.includes('ddu')) {
    return { type: 'ddu', label: '自税(DDU)', isDoubleClearance: false };
  }
  if (s.includes('自税') && s.includes('dap')) {
    return { type: 'dap', label: '自税(DAP)', isDoubleClearance: false };
  }
  if (s.includes('自税') || s.includes('不包税')) {
    return { type: 'ddu', label: '自税', isDoubleClearance: false };
  }
  if (s.includes('acp') || s.includes('逆算')) {
    if (s.includes('包')) return { type: 'reverse_calc', label: '包逆算', isDoubleClearance: true };
    return { type: 'acp', label: 'ACP逆算', isDoubleClearance: false };
  }
  if (s.includes('单票单清')) {
    return { type: 'customer_clearance', label: '单票单清', isDoubleClearance: false };
  }
  if (s === 'standard' || s === '标准') {
    return { type: 'standard', label: '标准服务', isDoubleClearance: false };
  }
  if (s === 'unknown' || s === '无' || s === '') {
    return { type: 'unknown', label: SERVICE_TYPE_LABELS.unknown, isDoubleClearance: false };
  }
  return { type: 'unknown', label: raw.trim() || SERVICE_TYPE_LABELS.unknown, isDoubleClearance: false };
}

interface PricingRuleRow {
  id: string;
  routeId: string | null;
  routeCode: string | null;
  minWeight: string;
  maxWeight: string | null;
  unitPrice: string | null;
  firstWeightPrice: string | null;
  continuedWeightPrice: string | null;
  minCharge: string | null;
  countries: string | null;
  remark: string | null;
  ruleType: string | null;
  taxFee: string | null;
  woodenBoxPrice: string | null;
  woodenFramePrice: string | null;
  fuelSurcharge: string | null;
  remoteAreaSurcharge: string | null;
  overLengthSurcharge: string | null;
  overWeightSurcharge: string | null;
  overPerimeterSurcharge: string | null;
  overLengthCondition: string | null;
  overWeightCondition: string | null;
  registrationFee: string | null;
  customsClearanceFee: string | null;
  podFee: string | null;
  palletFee: unknown;
  routeName: string | null;
  applicableRegions: string | null;
  zipCodeRanges: string | null;
  minLength: string | null;
  maxLength: string | null;
  unitPriceUnit: string | null;
  firstWeightUnit: string | null;
  continuedWeightUnit: string | null;
  packageUnit: string | null;
}

interface MatchedCandidate {
  routeId: string;
  routeName: string;
  providerName: string | null;
  channelType: ChannelType | null;
  transportType: TransportType;
  lastMileDoor: boolean | null;
  totalPrice: number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  paymentDays: number;
  paymentTerm?: string;
  cooperationCount: number | null;
  serviceType: string;
  serviceTypeLabel: string;
  priceDetail: InquiryPriceDetail;
  remark: string;
  priceNote: string;
  actualWeight: number;
  volumetricWeight: number;
  usedVolumetric: boolean;
  billingFormula: string[];
}

function normalizeTransportType(raw: string | null | undefined): TransportType {
  if (raw === '干线+尾程派送') return 'trunk_lastmile';
  if (raw === '仅国际干线') return 'international_trunk_only';
  if (raw === '仅海外尾程派送') return 'overseas_lastmile_only';
  return 'trunk_lastmile';
}

function buildLastMileDoorLabel(lastMileDoor: boolean | null): string {
  if (lastMileDoor === true) return '派送到门';
  return '需向货代确认最终派送地点';
}

function detectBillingMode(routeName: string, rule: PricingRuleRow): BillingMode {
  const parsedUnit = parseBillingUnit(rule.unitPriceUnit);
  if (parsedUnit.unit === 'ticket') return 'per_ticket';
  if (parsedUnit.unit === 'container') return 'per_ticket';
  const remark: string = rule.remark || '';

  if (routeName.includes('e特快')) return 'first_weight_50g';
  if (routeName.includes('EMS') || routeName.includes('ems')) return 'first_weight_500g';

  if (rule.firstWeightPrice && rule.continuedWeightPrice) {
    if (remark.includes('50g')) return 'first_weight_50g';
    if (remark.includes('500g')) return 'first_weight_500g';
    if (remark.includes('1kg')) return 'first_weight_1kg';
    if (routeName.includes('中速')) return 'first_weight_500g';
    if (routeName.includes('e邮宝')) return 'first_weight_500g';
    if (routeName.includes('示例货代B')) return 'first_weight_1kg';
    if (routeName.includes('国际航空包裹') || routeName.includes('国际SAL') || routeName.includes('国际水陆路')) return 'first_weight_1kg';
    return 'first_weight_1kg';
  }

  if (rule.firstWeightPrice && parsedUnit.stepSize) {
    return 'step_unit';
  }

  if (rule.unitPrice) {
    if (routeName.includes('e邮宝')) return 'per_item_per_kg';
    return 'per_kg';
  }

  return 'per_kg';
}

function buildBillingModeLabel(mode: BillingMode | 'volume'): string {
  if (mode === 'volume') return '体积计费(CBM)';
  switch (mode) {
    case 'first_weight_50g': return '首重50g + 续重/50g';
    case 'first_weight_500g': return '首重500g + 续重/500g';
    case 'first_weight_1kg': return '首重1kg + 续重/kg';
    case 'step_unit': return '首重 + 续重/步进';
    case 'per_item_per_kg': return '处理费/件 + 重量费/kg';
    case 'per_kg': return '单价/kg';
    case 'per_ticket': return '按票计费';
    case 'range_price': return '固定区间价';
  }
}

function calculatePrice(
  mode: BillingMode,
  totalWeight: number,
  rule: PricingRuleRow,
  currencyRate: number,
  quantity: number,
): { price: number; weightCharge: number; unitPriceVal: number | null; fwpVal: number | null; cwpVal: number | null; formulaLines: string[] } | null {
  const minChargeParsed: number = parseFloat(rule.minCharge);
  const minCharge: number = Number.isFinite(minChargeParsed) ? minChargeParsed : 0;
  const tw: string = totalWeight.toFixed(2);

  switch (mode) {
    case 'first_weight_50g': {
      if (!rule.firstWeightPrice || !rule.continuedWeightPrice) return null;
      const fwp: number = parseFloat(rule.firstWeightPrice);
      const cwp: number = parseFloat(rule.continuedWeightPrice);
      if (!Number.isFinite(fwp) || !Number.isFinite(cwp)) return null;
      const fwpConv: number = fwp * currencyRate;
      const cwpConv: number = cwp * currencyRate;
      const units50g: number = Math.ceil(totalWeight * 1000 / 50);
      const continuedUnits: number = Math.max(units50g - 1, 0);
      const charge: number = fwpConv + cwpConv * continuedUnits;
      const finalPrice: number = Math.max(charge, minCharge);
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg = ${units50g} × 50g`,
        `运费 = 首重费${curSym}${fwp.toFixed(2)} + 续重费${curSym}${cwp.toFixed(2)} × ${continuedUnits}${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: null, fwpVal: fwpConv, cwpVal: cwpConv, formulaLines };
    }
    case 'first_weight_500g': {
      if (!rule.firstWeightPrice || !rule.continuedWeightPrice) return null;
      const fwp: number = parseFloat(rule.firstWeightPrice);
      const cwp: number = parseFloat(rule.continuedWeightPrice);
      if (!Number.isFinite(fwp) || !Number.isFinite(cwp)) return null;
      const fwpConv: number = fwp * currencyRate;
      const cwpConv: number = cwp * currencyRate;
      const units500g: number = Math.ceil(totalWeight * 1000 / 500);
      const continuedUnits: number = Math.max(units500g - 1, 0);
      const charge: number = fwpConv + cwpConv * continuedUnits;
      const finalPrice: number = Math.max(charge, minCharge);
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg = ${units500g} × 500g`,
        `运费 = 首重费${curSym}${fwp.toFixed(2)} + 续重费${curSym}${cwp.toFixed(2)} × ${continuedUnits}${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: null, fwpVal: fwpConv, cwpVal: cwpConv, formulaLines };
    }
    case 'first_weight_1kg': {
      if (!rule.firstWeightPrice || !rule.continuedWeightPrice) return null;
      const fwp: number = parseFloat(rule.firstWeightPrice);
      const cwp: number = parseFloat(rule.continuedWeightPrice);
      if (!Number.isFinite(fwp) || !Number.isFinite(cwp)) return null;
      const fwpConv: number = fwp * currencyRate;
      const cwpConv: number = cwp * currencyRate;
      const continuedKg: number = Math.max(Math.ceil(totalWeight - 1), 0);
      const charge: number = fwpConv + cwpConv * continuedKg;
      const finalPrice: number = Math.max(charge, minCharge);
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg`,
        `运费 = 首重费${curSym}${fwp.toFixed(2)} + 续重费${curSym}${cwp.toFixed(2)} × ${continuedKg}${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: null, fwpVal: fwpConv, cwpVal: cwpConv, formulaLines };
    }
    case 'per_item_per_kg': {
      if (!rule.unitPrice) return null;
      const upRaw: number = parseFloat(rule.unitPrice);
      if (!Number.isFinite(upRaw)) return null;
      const up: number = upRaw * currencyRate;
      const weightFee: number = up * totalWeight;
      const charge: number = Math.max(weightFee, minCharge);
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg`,
        `重量费 = ${curSym}${upRaw.toFixed(2)}/kg × ${tw}kg${rateSuffix} = ¥${weightFee.toFixed(2)}`,
        `运费小计: ¥${charge.toFixed(2)}`,
      ];
      return { price: charge, weightCharge: weightFee, unitPriceVal: up, fwpVal: null, cwpVal: null, formulaLines };
    }
    case 'per_kg': {
      if (!rule.unitPrice) return null;
      const upRaw: number = parseFloat(rule.unitPrice);
      if (!Number.isFinite(upRaw)) return null;
      const up: number = upRaw * currencyRate;
      const charge: number = up * totalWeight;
      const finalPrice: number = Number.isFinite(charge) ? Math.max(charge, minCharge) : 0;
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg`,
        `运费 = ${curSym}${upRaw.toFixed(2)}/kg × ${tw}kg${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: up, fwpVal: null, cwpVal: null, formulaLines };
    }
    case 'step_unit': {
      if (!rule.firstWeightPrice || !rule.unitPrice) return null;
      const fwp: number = parseFloat(rule.firstWeightPrice);
      const upRaw: number = parseFloat(rule.unitPrice);
      if (!Number.isFinite(fwp) || !Number.isFinite(upRaw)) return null;
      const parsed = parseBillingUnit(rule.unitPriceUnit);
      const stepSize: number = parsed.stepSize ?? 1;
      const fwpConv: number = fwp * currencyRate;
      const upConv: number = upRaw * currencyRate;
      const totalSteps: number = Math.ceil(totalWeight / stepSize);
      const continuedSteps: number = Math.max(totalSteps - 1, 0);
      const charge: number = fwpConv + upConv * continuedSteps;
      const finalPrice: number = Math.max(charge, minCharge);
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg = ${totalSteps} × ${stepSize}kg`,
        `运费 = 首重费${curSym}${fwp.toFixed(2)} + 续重费${curSym}${upRaw.toFixed(2)}/${stepSize}kg × ${continuedSteps}${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: upConv, fwpVal: fwpConv, cwpVal: upConv, formulaLines };
    }
    case 'per_ticket': {
      if (!rule.unitPrice) return null;
      const upRaw: number = parseFloat(rule.unitPrice);
      if (!Number.isFinite(upRaw)) return null;
      const up: number = upRaw * currencyRate;
      const charge: number = up * quantity;
      const finalPrice: number = Number.isFinite(charge) ? Math.max(charge, minCharge) : 0;
      const curSym: string = currencyRate !== 1 ? '$' : '¥';
      const rateSuffix: string = currencyRate !== 1 ? ` × ${currencyRate}(汇率)` : '';
      const formulaLines: string[] = [
        `计费重量: ${tw}kg (仅用于匹配重量段)`,
        `运费 = ${curSym}${upRaw.toFixed(2)}/票 × ${quantity}件${rateSuffix} = ¥${charge.toFixed(2)}`,
      ];
      if (minCharge > charge) formulaLines.push(`低于最低起运费¥${minCharge.toFixed(2)}，按最低起运费计`);
      formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
      return { price: finalPrice, weightCharge: charge, unitPriceVal: up, fwpVal: null, cwpVal: null, formulaLines };
    }
  }
  return null;
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  '阿拉伯联合酋长国': ['阿联酋', 'UAE'],
  '阿联酋': ['阿拉伯联合酋长国', 'UAE'],
  '美国': ['美利坚合众国', 'USA'],
  '英国': ['联合王国', 'UK', 'United Kingdom'],
  '韩国': ['大韩民国', '南韩'],
  '俄罗斯': ['俄罗斯联邦', '俄国'],
  '越南': ['越南社会主义共和国'],
  '日本': ['Japan'],
  '德国': ['德意志联邦共和国'],
  '法国': ['法兰西共和国'],
  '澳大利亚': ['澳洲', 'Australia'],
  '加拿大': ['Canada'],
  '印度尼西亚': ['印尼'],
  '印尼': ['印度尼西亚'],
  '蒙古国': ['蒙古'],
  '蒙古': ['蒙古国'],
};

interface DimGroup {
  length: number;
  width: number;
  height: number;
  quantity: number;
}

function calcVolumetricWeight(
  groups: DimGroup[],
  divisor: number,
  postalThreshold: boolean,
  packagingType?: string,
): number {
  const needWoodenAdjust: boolean = packagingType === '需打木箱' || packagingType === '需打木架';
  let totalVol: number = 0;
  for (const g of groups) {
    if (!g.length || !g.width || !g.height) continue;
    const l: number = needWoodenAdjust ? g.length + 5 : g.length;
    const w: number = needWoodenAdjust ? g.width + 5 : g.width;
    const h: number = needWoodenAdjust ? g.height + 15 : g.height;
    if (postalThreshold && l <= 40 && w <= 40 && h <= 40) continue;
    totalVol += l * w * h * g.quantity;
  }
  const rawVolumetricWeight: number = totalVol / divisor;
  return rawVolumetricWeight > 0 ? Math.ceil(rawVolumetricWeight) : 0;
}

function calcCbmVolume(groups: DimGroup[], packagingType?: string): number {
  const needWoodenAdjust: boolean = packagingType === '需打木箱' || packagingType === '需打木架';
  let totalCbm: number = 0;
  for (const g of groups) {
    if (!g.length || !g.width || !g.height) continue;
    const l: number = needWoodenAdjust ? g.length + 5 : g.length;
    const w: number = needWoodenAdjust ? g.width + 5 : g.width;
    const h: number = needWoodenAdjust ? g.height + 15 : g.height;
    totalCbm += (l * w * h * g.quantity) / 1_000_000;
  }
  return totalCbm;
}

interface OversizeSurcharge {
  threshold?: number;
  amount?: number;
  unit?: string;
  description?: string;
  tiers?: Array<{ condition: string; amount: string }>;
}

const CATEGORY_NORMALIZATION: Record<string, string> = {
  '饰品': '普货', '手表': '普货', '机械手表': '普货',
  '纺织': '普货', '纺织品': '普货',
  '厨房': '普货', '厨房用品': '普货',
  '生活': '普货', '生活用品': '普货', '家具': '普货',
  '手机配件': '普货', '电脑配件': '普货',
  '玩具': '普货', '不带电玩具': '普货', '电商杂货': '普货',
  '汽配': '普货', '简单汽配': '普货',
  '灯具': '普货', '灯具类': '普货',
  '卫浴': '普货', '卫浴洁具': '普货', '卫浴陶瓷': '普货',
  '广告机': '普货', '摄像头': '普货', '摄像头类': '普货', '开关': '普货',
  '滑板车': '普货', '服装': '普货', '鞋类': '普货', '箱包': '普货',
  '杂货': '普货', '普通货物': '普货', '交通工具': '普货', '大型机器': '普货',
  'LED显示屏': '带电', 'LED': '带电', '风机': '带电', '风机类': '带电',
  '内置电': '带电', '带电产品': '带电', '电子产品': '带电',
  '电池': '纯电', '纯电池': '纯电', '锂电池': '纯电',
  '液体': '特货', '粉末': '特货', '膏体': '特货', '液体/粉末/膏体': '特货',
  '带磁': '带磁', '磁性产品': '带磁',
};

function normalizeCategory(category: string): string {
  return CATEGORY_NORMALIZATION[category] || category;
}

function parseOverLengthCondition(condition: string | null): number | null {
  if (!condition) return null;
  const mMatch = condition.match(/(\d+(?:\.\d+)?)\s*(?:m\b|米)/i);
  if (mMatch) return parseFloat(mMatch[1]) * 100;
  const cmMatch = condition.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
  if (cmMatch) return parseFloat(cmMatch[1]);
  const numMatch = condition.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
}

function parseOverWeightCondition(condition: string | null): number | null {
  if (!condition) return null;
  const kgMatch = condition.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) return parseFloat(kgMatch[1]);
  const numMatch = condition.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);
  return null;
}

interface RemoteAreaSurchargeData {
  description?: string;
  type?: string;
  amount?: number;
  minCharge?: number;
  tiers?: Array<{ condition: string; amount: string }>;
}

function calcRemoteAreaSurcharge(
  postalCode: string,
  city: string,
  totalWeight: number,
  remoteAreaSurcharge: string | null,
): { amount: number; description: string } | null {
  if (!remoteAreaSurcharge) return null;

  const perKgMatch = remoteAreaSurcharge.match(/(\d+(?:\.\d+)?)\s*(?:元|欧)?\/\s*KG/i);
  const minMatch = remoteAreaSurcharge.match(/最低\s*(\d+(?:\.\d+)?)\s*(?:元|欧)?\/\s*票/);
  const perPieceMatch = remoteAreaSurcharge.match(/(\d+(?:\.\d+)?)\s*元\/\s*件/);

  if (perKgMatch) {
    const rate = parseFloat(perKgMatch[1]);
    const min = minMatch ? parseFloat(minMatch[1]) : 0;
    const fee = Math.max(rate * totalWeight, min);
    if (Number.isFinite(fee) && fee > 0) return { amount: fee, description: remoteAreaSurcharge };
  }

  if (perPieceMatch) {
    const fee = parseFloat(perPieceMatch[1]);
    const min = minMatch ? parseFloat(minMatch[1]) : 0;
    const finalFee = Math.max(fee, min);
    if (Number.isFinite(finalFee) && finalFee > 0) return { amount: finalFee, description: remoteAreaSurcharge };
  }

  return null;
}

function calcFuelSurcharge(
  baseFreight: number,
  fuelSurchargeRate: string | null,
): { amount: number; description: string } | null {
  if (!fuelSurchargeRate || baseFreight <= 0) return null;

  const trimmed = fuelSurchargeRate.trim();
  const hasPercent = trimmed.includes('%');
  const rate: number = parseFloat(trimmed);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const normalizedRate = hasPercent ? rate / 100 : (rate > 1 ? rate / 100 : rate);
  if (normalizedRate <= 0 || normalizedRate > 1) return null;

  const fee: number = Math.round(baseFreight * normalizedRate * 100) / 100;

  return {
    amount: fee,
    description: `基础运费¥${baseFreight.toFixed(2)} × ${(normalizedRate * 100).toFixed(1)}% = ¥${fee.toFixed(2)}`,
  };
}

function parseSimpleFee(rawValue: string | null): { amount: number; raw: string; perUnit: 'piece' | 'kg' | null } | null {
  if (!rawValue || !rawValue.trim()) return null;
  const trimmed = rawValue.trim();

  const perUnitMatch = trimmed.match(/\/\s*(件|票|箱|叉|KG|kg|CBM|cbm)/);
  let perUnit: 'piece' | 'kg' | null = null;
  if (perUnitMatch) {
    const u = perUnitMatch[1].toLowerCase();
    if (u === 'kg') perUnit = 'kg';
    else if (u === '票') perUnit = null;
    else perUnit = 'piece';
  }

  const feeWithYuan = trimmed.match(/(\d+(?:\.\d+)?)\s*元/);
  if (feeWithYuan) {
    const amount = parseFloat(feeWithYuan[1]);
    if (Number.isFinite(amount) && amount > 0) return { amount, raw: trimmed, perUnit };
  }

  const feePerUnit = trimmed.match(/(\d+(?:\.\d+)?)\s*\/\s*(?:件|票|箱)/);
  if (feePerUnit) {
    const amount = parseFloat(feePerUnit[1]);
    if (Number.isFinite(amount) && amount > 0) return { amount, raw: trimmed, perUnit };
  }

  const allNumbers = [...trimmed.matchAll(/(\d+(?:\.\d+)?)/g)];
  for (const m of allNumbers) {
    const afterNum = trimmed.slice(m.index! + m[0].length).trimStart();
    if (/^(cm|CM|KG|kg|m\b|米)/.test(afterNum)) continue;
    const amount = parseFloat(m[1]);
    if (Number.isFinite(amount) && amount > 0) return { amount, raw: trimmed, perUnit };
  }

  return null;
}

function applySurchargeMultiplier(
  amount: number,
  perUnit: 'piece' | 'kg' | null,
  quantity: number,
  totalWeight: number,
): number {
  if (perUnit === 'piece') return amount * quantity;
  if (perUnit === 'kg') return amount * totalWeight;
  return amount;
}

function parseTieredSurcharge(
  rawValue: string | null,
  measurement: number,
): { amount: number; description: string; perUnit: 'piece' | 'kg' | null } | null {
  if (!rawValue || !rawValue.trim()) return null;
  if (!/[;；]/.test(rawValue)) return null;

  const tiers = rawValue.split(/[;；]/).map(t => t.trim()).filter(t => t.length > 0);
  if (tiers.length < 2) return null;

  const rangePatterns: Array<{ regex: RegExp; isMeter: boolean }> = [
    { regex: /(?:≥|>)(\d+(?:\.\d+)?)\s*[-—~到]\s*(\d+(?:\.\d+)?)\s*(?:CM|cm)/, isMeter: false },
    { regex: /(?:≥|>)(\d+(?:\.\d+)?)\s*(?:CM|cm)/, isMeter: false },
    { regex: /(?:≥|>)(\d+(?:\.\d+)?)\s*(?:KG|kg)/, isMeter: false },
    { regex: /超(?:过)?(\d+(?:\.\d+)?)\s*米/, isMeter: true },
  ];

  let bestMatch: { amount: number; description: string; perUnit: 'piece' | 'kg' | null; min: number } | null = null;

  for (const tier of tiers) {
    let min: number | null = null;
    let max: number | null = null;
    let isStrictGt = false;
    let matchEnd = 0;

    for (const { regex, isMeter } of rangePatterns) {
      const m = tier.match(regex);
      if (m) {
        isStrictGt = m[0].startsWith('>') && !m[0].startsWith('≥');
        min = parseFloat(m[1]);
        if (isMeter) min *= 100;
        if (m[2]) {
          max = parseFloat(m[2]);
          if (isMeter) max *= 100;
        }
        matchEnd = (m.index ?? 0) + m[0].length;
        break;
      }
    }

    if (min === null) continue;

    const inRange = isStrictGt
      ? measurement > min && (max === null || measurement <= max)
      : measurement >= min && (max === null || measurement <= max);
    if (!inRange) continue;

    const afterRange = tier.slice(matchEnd);
    const amountMatch = afterRange.match(/(\d+(?:\.\d+)?)\s*(?:元|RMB|欧)?(?:\/(件|票|箱|叉|KG|kg))?/);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    let perUnit: 'piece' | 'kg' | null = null;
    if (amountMatch[2]) {
      const u = amountMatch[2].toLowerCase();
      if (u === 'kg') perUnit = 'kg';
      else if (u === '票') perUnit = null;
      else perUnit = 'piece';
    }

    if (!bestMatch || min > bestMatch.min) {
      bestMatch = { amount, description: tier.trim(), perUnit, min };
    }
  }

  if (!bestMatch) return null;
  return { amount: bestMatch.amount, description: bestMatch.description, perUnit: bestMatch.perUnit };
}

const ALL_SURCHARGE_FIELDS: Array<{ key: keyof PricingRuleRow; label: string }> = [
  { key: 'overLengthSurcharge', label: '超长附加费' },
  { key: 'overWeightSurcharge', label: '超重附加费' },
  { key: 'overPerimeterSurcharge', label: '超周长附加费' },
  { key: 'remoteAreaSurcharge', label: '偏远地区附加费' },
  { key: 'fuelSurcharge', label: '燃油附加费' },
  { key: 'registrationFee', label: '挂号费' },
  { key: 'customsClearanceFee', label: '清关费' },
  { key: 'podFee', label: 'POD签收费' },
  { key: 'taxFee', label: '税费' },
  { key: 'woodenBoxPrice', label: '木箱包装费' },
  { key: 'woodenFramePrice', label: '木架包装费' },
];

function getDimensionGroups(request: {
  length: number;
  width: number;
  height: number;
  quantity: number;
  packagesCount: number;
  dimensionGroups?: DimGroup[];
}): DimGroup[] {
  if (request.dimensionGroups && request.dimensionGroups.length > 0) {
    return request.dimensionGroups;
  }
  if (request.length && request.width && request.height) {
    const pkgs: number = request.packagesCount || request.quantity || 1;
    return [{ length: request.length, width: request.width, height: request.height, quantity: pkgs }];
  }
  return [];
}

function countryEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aliases: string[] = COUNTRY_ALIASES[a] || [];
  if (aliases.includes(b)) return true;
  const aliasesB: string[] = COUNTRY_ALIASES[b] || [];
  if (aliasesB.includes(a)) return true;
  return false;
}

function splitCountries(countriesStr: string): string[] {
  if (!countriesStr) return [];
  return countriesStr
    .split(/[,、，；;\/\s]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

const KNOWN_COUNTRIES: string[] = [
  '美国', '英国', '加拿大', '澳大利亚', '德国', '法国', '日本', '韩国',
  '俄罗斯', '白俄罗斯', '哈萨克斯坦', '吉尔吉斯斯坦', '乌克兰',
  '新加坡', '马来西亚', '泰国', '越南', '菲律宾', '印度尼西亚',
  '巴西', '墨西哥', '印度', '意大利', '西班牙', '荷兰',
];

function countryStartsWith(ruleValue: string, userCountry: string): boolean {
  if (!ruleValue || !userCountry) return false;
  if (ruleValue === userCountry) return true;
  if (ruleValue.startsWith(userCountry) && ruleValue.length > userCountry.length) return true;
  for (const known of KNOWN_COUNTRIES) {
    if (ruleValue.startsWith(known) && (known === userCountry || countryEquals(known, userCountry))) {
      return true;
    }
  }
  return false;
}

function matchCountry(ruleCountries: string | null, routeCountries: string, userCountry: string): boolean {
  // 先校验线路级：线路必须覆盖该国家
  const routeList: string[] = splitCountries(routeCountries);
  const routeCoversGlobal: boolean = routeList.includes('全球');
  const routeCoversCountry: boolean = routeList.some(c => countryEquals(c, userCountry));

  if (!routeCoversGlobal && !routeCoversCountry) return false;

  // 再校验规则级：如果规则指定了国家，必须匹配
  if (ruleCountries) {
    const ruleList: string[] = splitCountries(ruleCountries);
    if (ruleList.length === 0) return true;
    return ruleList.some(c => countryEquals(c, userCountry) || countryStartsWith(c, userCountry));
  }

  return true;
}

function matchPostalCode(ruleCountries: string | null, postalCode: string): boolean {
  if (!ruleCountries || !postalCode) return true;
  if (ruleCountries.includes('邮编')) {
    const firstDigit: string = postalCode.charAt(0);
    const digits: string = ruleCountries.replace(/[^0-9,]/g, '');
    const digitList: string[] = digits.split(/[,，]/).map((d: string) => d.trim());
    return digitList.includes(firstDigit);
  }
  return true;
}

interface ZipRange {
  start: number;
  end: number;
  len: number;
}

function parseZipRanges(raw: string): { includes: ZipRange[]; excludes: ZipRange[] } | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === '无' || s === '全境') return { includes: [], excludes: [] };
  let cleaned = s
    .replace(/^(东部|西部|中部|东区|西区|中区|美东|美西|美中)/i, '')
    .replace(/开头$/g, '')
    .replace(/^邮编\s*/i, '')
    .trim();
  if (!cleaned) return null;

  const excludeMatch = cleaned.match(/[（(]不含([^）)]+)[）)]/);
  const excludeRaw = excludeMatch ? excludeMatch[1] : '';
  if (excludeMatch) {
    cleaned = cleaned.replace(excludeMatch[0], '').trim();
  }

  const parseSegments = (text: string): ZipRange[] => {
    const parts = text.split(/[,，、;；\s]+/).filter(Boolean);
    const result: ZipRange[] = [];
    for (const part of parts) {
      const rangeM = part.match(/^(\d+)\s*[-–—~～]\s*(\d+)$/);
      if (rangeM) {
        const start = parseInt(rangeM[1], 10);
        const end = parseInt(rangeM[2], 10);
        const len = Math.max(rangeM[1].length, rangeM[2].length);
        result.push({ start, end, len });
        continue;
      }
      const numM = part.match(/^(\d+)$/);
      if (numM) {
        const val = parseInt(numM[1], 10);
        result.push({ start: val, end: val, len: numM[1].length });
      }
    }
    return result;
  };

  return {
    includes: parseSegments(cleaned),
    excludes: parseSegments(excludeRaw),
  };
}

function zipInRanges(zip: string, ranges: ZipRange[]): boolean {
  if (ranges.length === 0) return true;
  for (const r of ranges) {
    const prefix = parseInt(zip.slice(0, r.len), 10);
    if (!isNaN(prefix) && prefix >= r.start && prefix <= r.end) return true;
  }
  return false;
}

function matchZipCode(zipCodeRanges: string | null, applicableRegions: string | null, postalCode: string | undefined): boolean {
  if (!postalCode) return true;

  const parsed = parseZipRanges(zipCodeRanges || '');
  if (parsed) {
    const hit = zipInRanges(postalCode, parsed.includes);
    if (!hit) return false;
    if (parsed.excludes.length > 0 && zipInRanges(postalCode, parsed.excludes)) return false;
    return true;
  }

  if (applicableRegions) {
    const region = applicableRegions.trim();
    const regionMap: Record<string, string[]> = {
      '美西': ['8', '9'],
      '美国西': ['8', '9'],
      '西部': ['8', '9'],
      '美东': ['0', '1', '2', '3', '4'],
      '美国东': ['0', '1', '2', '3', '4'],
      '东部': ['0', '1', '2', '3', '4'],
      '美中': ['5', '6', '7'],
      '美国中': ['5', '6', '7'],
      '中部': ['5', '6', '7'],
    };
    const firstDigit = postalCode.charAt(0);
    const digits = regionMap[region];
    if (digits && !digits.includes(firstDigit)) return false;

    const regionZipParsed = parseZipRanges(region.replace(/^邮编\s*/i, ''));
    if (regionZipParsed && regionZipParsed.includes.length > 0) {
      const hit = zipInRanges(postalCode, regionZipParsed.includes);
      if (!hit) return false;
      if (regionZipParsed.excludes.length > 0 && zipInRanges(postalCode, regionZipParsed.excludes)) return false;
    }
  }

  return true;
}

function buildPriceNote(
  routeName: string,
  mode: BillingMode | 'volume',
  rule: PricingRuleRow,
  totalWeight: number,
  actualWeight?: number,
  volumetricWeight?: number,
  usedVolumetric?: boolean,
): string {
  const parts: string[] = [];
  parts.push(`计费方式: ${buildBillingModeLabel(mode)}`);

  if (mode === 'volume') {
    return parts.join(' | ');
  }

  if (usedVolumetric && actualWeight && volumetricWeight && volumetricWeight > actualWeight) {
    parts.push(`计费重量: ${totalWeight.toFixed(2)}kg (实重${actualWeight.toFixed(2)}kg, 体积重${volumetricWeight.toFixed(2)}kg取大)`);
  }

  if (rule.minWeight && parseFloat(rule.minWeight) > 0) {
    parts.push(`最低起运 ${rule.minWeight}kg`);
  }

  if (rule.countries) {
    parts.push(`适用区域: ${rule.countries}`);
  }

  if (routeName.includes('带电')) {
    parts.push('带电/带磁物品专线，普货请使用标准线路');
  } else if (routeName.includes('纯电')) {
    parts.push('纯电物品专线，非纯电池物品请使用标准线路');
  } else if (routeName.includes('DG')) {
    parts.push('危险品专线');
  } else if (routeName.includes('自税')) {
    parts.push('不包税，需自行缴纳关税');
  }

  if (rule.remark) {
    const alreadyIncluded: boolean = parts.some((p: string) => p.includes(rule.remark as string));
    if (!alreadyIncluded) {
      parts.push(rule.remark);
    }
  }

  return parts.join(' | ');
}

type ActiveRouteRow = {
  id: string;
  name: string;
  coverCountries: string;
  coverCities: string | null;
  postalCodeRange: string | null;
  supportedCategories: string | null;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  isActive: string;
  packagingRestriction: string | null;
  remark: string | null;
  channelType: string | null;
  transportType: string | null;
  sumDimensionLimit: number | null;
  longestSideLimit: number | null;
  serviceType: string | null;
  billingMode: string;
  lastMileDoor: boolean | null;
  perimeterLimit: string | null;
  lengthLimit: number | null;
  widthLimit: number | null;
  heightLimit: number | null;
  providerName: string | null;
  currency: string | null;
  routeCode: string | null;
};

interface InquiryCache {
  activeRoutes: ActiveRouteRow[];
  coopMap: Map<string, number>;
  paymentMap: Map<string, { paymentTerm: string; paymentMethod: string | null }>;
  allPricingRules: PricingRuleRow[];
  timestamp: number;
}

const INQUIRY_CACHE_TTL = 60000;

@Injectable()
export class LogisticsInquiryService {
  private readonly logger = new Logger(LogisticsInquiryService.name);
  private inquiryCache: InquiryCache | null = null;

  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly db: PostgresJsDatabase,
  ) {}

  private async loadInquiryCache(): Promise<InquiryCache> {
    if (this.inquiryCache && Date.now() - this.inquiryCache.timestamp < INQUIRY_CACHE_TTL) {
      return this.inquiryCache;
    }

    const activeRoutes: ActiveRouteRow[] = await this.db
      .select({
        id: logisticsRoute.id,
        name: logisticsRoute.name,
        coverCountries: logisticsRoute.coverCountries,
        coverCities: logisticsRoute.coverCities,
        postalCodeRange: logisticsRoute.postalCodeRange,
        supportedCategories: logisticsRoute.supportedCategories,
        minDeliveryDays: logisticsRoute.minDeliveryDays,
        maxDeliveryDays: logisticsRoute.maxDeliveryDays,
        isActive: logisticsRoute.isActive,
        packagingRestriction: logisticsRoute.packagingRestriction,
        remark: logisticsRoute.remark,
        channelType: logisticsRoute.channelType,
        transportType: logisticsRoute.transportType,
        sumDimensionLimit: logisticsRoute.sumDimensionLimit,
        longestSideLimit: logisticsRoute.longestSideLimit,
        serviceType: logisticsRoute.serviceType,
        billingMode: logisticsRoute.billingMode,
        lastMileDoor: logisticsRoute.lastMileDoor,
        perimeterLimit: logisticsRoute.perimeterLimit,
        lengthLimit: logisticsRoute.lengthLimit,
        widthLimit: logisticsRoute.widthLimit,
        heightLimit: logisticsRoute.heightLimit,
        providerName: logisticsRoute.providerName,
        currency: logisticsRoute.currency,
        routeCode: logisticsRoute.routeCode,
      })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.isActive, '启用'));

    this.logger.log(`[Cache] 加载 ${activeRoutes.length} 条启用线路`);

    const coopRecords = await this.db
      .select({
        shortname: freightForwarderCoopCount.freightForwarderShortname,
        times: freightForwarderCoopCount.cooperationTimes,
      })
      .from(freightForwarderCoopCount);

    const coopMap = new Map<string, number>();
    for (const record of coopRecords) {
      if (record.shortname && record.times != null && record.times > 0) {
        coopMap.set(record.shortname, record.times);
      }
    }

    this.logger.log(`[Cache] 加载 ${coopRecords.length} 条货代合作记录，有效 ${coopMap.size} 条`);

    const paymentRecords = await this.db
      .select({
        name: forwarderSupplierPayment.name,
        paymentTerm: forwarderSupplierPayment.paymentTerm,
        paymentMethod: forwarderSupplierPayment.paymentMethod,
      })
      .from(forwarderSupplierPayment);

    const paymentMap = new Map<string, { paymentTerm: string; paymentMethod: string | null }>();
    for (const record of paymentRecords) {
      if (record.name && record.paymentTerm) {
        paymentMap.set(record.name, { paymentTerm: record.paymentTerm, paymentMethod: record.paymentMethod });
      }
    }

    this.logger.log(`[Cache] 加载 ${paymentRecords.length} 条货代账期记录，有效 ${paymentMap.size} 条`);

    const allPricingRules: PricingRuleRow[] = await this.db
      .select({
        id: pricingRule.id,
        routeId: pricingRule.routeId,
        routeCode: pricingRule.routeCode,
        minWeight: pricingRule.minWeight,
        maxWeight: pricingRule.maxWeight,
        unitPrice: pricingRule.unitPrice,
        firstWeightPrice: pricingRule.firstWeightPrice,
        continuedWeightPrice: pricingRule.continuedWeightPrice,
        minCharge: pricingRule.minCharge,
        countries: pricingRule.countries,
        remark: pricingRule.remark,
        ruleType: pricingRule.ruleType,
        woodenBoxPrice: pricingRule.woodenBoxPrice,
        woodenFramePrice: pricingRule.woodenFramePrice,
        taxFee: pricingRule.taxFee,
        remoteAreaSurcharge: pricingRule.remoteAreaSurcharge,
        overLengthSurcharge: pricingRule.overLengthSurcharge,
        overWeightSurcharge: pricingRule.overWeightSurcharge,
        overPerimeterSurcharge: pricingRule.overPerimeterSurcharge,
        overLengthCondition: pricingRule.overLengthCondition,
        overWeightCondition: pricingRule.overWeightCondition,
        fuelSurcharge: pricingRule.fuelSurcharge,
        registrationFee: pricingRule.registrationFee,
        customsClearanceFee: pricingRule.customsClearanceFee,
        podFee: pricingRule.podFee,
        palletFee: pricingRule.palletFee,
        routeName: pricingRule.routeName,
        applicableRegions: pricingRule.applicableRegions,
        zipCodeRanges: pricingRule.zipCodeRanges,
        minLength: pricingRule.minLength,
        maxLength: pricingRule.maxLength,
        unitPriceUnit: pricingRule.unitPriceUnit,
        firstWeightUnit: pricingRule.firstWeightUnit,
        continuedWeightUnit: pricingRule.continuedWeightUnit,
        packageUnit: pricingRule.packageUnit,
      })
      .from(pricingRule);

    this.logger.log(`[Cache] 加载 ${allPricingRules.length} 条 pricing_rule`);

    this.inquiryCache = { activeRoutes, coopMap, paymentMap, allPricingRules, timestamp: Date.now() };
    return this.inquiryCache;
  }

  private resolveCooperationCount(providerName: string | null, coopMap: Map<string, number>): number | null {
    if (!providerName) return null;
    if (coopMap.has(providerName)) {
      return coopMap.get(providerName) as number;
    }
    const alias = FORWARDER_NAME_MAP[providerName];
    if (alias && coopMap.has(alias)) {
      return coopMap.get(alias) as number;
    }
    for (const [name, times] of coopMap) {
      if (providerName.includes(name) || name.includes(providerName)) {
        return times;
      }
    }
    return null;
  }

  private resolvePaymentInfo(
    providerName: string | null,
    paymentMap: Map<string, { paymentTerm: string; paymentMethod: string | null }>,
  ): { paymentTerm: string; paymentMethod: string | null } | null {
    if (!providerName) return null;
    if (paymentMap.has(providerName)) {
      return paymentMap.get(providerName) || null;
    }
    const alias = FORWARDER_NAME_MAP[providerName];
    if (alias && paymentMap.has(alias)) {
      return paymentMap.get(alias) || null;
    }
    for (const [name, info] of paymentMap) {
      if (providerName.includes(name) || name.includes(providerName)) {
        return info;
      }
    }
    return null;
  }

  async inquire(request: InquiryRequest): Promise<InquiryResponse> {
    const packages: number = request.packagesCount || request.quantity || 1;
    const actualWeight: number = request.weight * request.quantity;

    this.logger.log(`单件重量=${request.weight}kg, 件数=${request.quantity}, 包裹数=${packages}, 总实重=${actualWeight}kg`);

    const cache = await this.loadInquiryCache();
    const activeRoutes = cache.activeRoutes;
    const coopMap = cache.coopMap;
    const paymentMap = cache.paymentMap;

    this.logger.log(`单件重量=${request.weight}kg, 件数=${request.quantity}, 包裹数=${packages}, 总实重=${actualWeight}kg, 启用线路 ${activeRoutes.length} 条`);

    const matchedCandidates: MatchedCandidate[] = [];
    const candidateRouteIds: string[] = [];
    const candidateRouteCodes: string[] = [];

    for (const route of activeRoutes) {
      const billingMode = normalizeBillingMode(route.billingMode);

      const routeGroups: DimGroup[] = getDimensionGroups(request);
      const isPostalRoute: boolean = route.name.includes('EMS') || route.name.includes('ems') || route.name.includes('e特快');

      let routeVolumetricWeight: number = 0;
      if ((billingMode === 'volumetric_weight' || billingMode === 'max_both') && routeGroups.length > 0) {
        routeVolumetricWeight = calcVolumetricWeight(routeGroups, 6000, isPostalRoute, request.packagingType);
      }

      let routeEffectiveWeight: number = actualWeight;
      if (billingMode === 'volumetric_weight') {
        routeEffectiveWeight = routeVolumetricWeight > 0 ? routeVolumetricWeight : actualWeight;
      } else if (billingMode === 'max_both') {
        routeEffectiveWeight = Math.max(actualWeight, routeVolumetricWeight);
      } else if (billingMode === 'volume') {
        routeEffectiveWeight = actualWeight;
      }
      let totalWeight: number = routeEffectiveWeight;

      if (request.category) {
        const normalizedCategory = normalizeCategory(request.category);
        const categories: string[] = (route.supportedCategories || '')
          .split(/[,，、]/)
          .map((c: string) => c.trim())
          .filter((c: string) => c.length > 0);
        const routeIsBatteryRoute: boolean = route.name.includes('带电') || route.name.includes('纯电') || route.name.includes('DG') || route.name.includes('电池')
          || categories.includes('纯电') || categories.includes('带电');

        if (normalizedCategory === '危险品') {
          const dangerousCategories = ['纯电', '带电', '带磁', '特货', '液体/粉末/膏体'];
          if (!categories.some((c: string) => dangerousCategories.includes(c)) && !route.name.includes('危险')) continue;
        } else if (normalizedCategory === '纯电') {
          if (!routeIsBatteryRoute) continue;
          if (!categories.includes('纯电') && !route.name.includes('纯电')) continue;
        } else if (normalizedCategory === '带磁' || normalizedCategory === '带电') {
          if (!categories.includes(normalizedCategory)) continue;
        } else {
          const categoryMatch = categories.includes(request.category) || categories.includes(normalizedCategory);
          if (routeIsBatteryRoute && !categoryMatch) continue;
          if (categories.length > 0 && !categoryMatch) continue;
        }
      }

      if (route.packagingRestriction && request.packagingType) {
        const allowedPackaging: string[] = route.packagingRestriction
          .split(/[,，、/]/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);
        const effectivePackaging = request.packagingType
          .replace('已有', '').replace('需打', '');
        if (!allowedPackaging.includes(request.packagingType)
          && !allowedPackaging.includes(effectivePackaging)
          && !(allowedPackaging.includes('纸箱') && request.packagingType !== '编织袋')) continue;
      }

      // 非平台官方线路（不包含'示例平台'）尺寸超限直接过滤
      const isPlatformRoute: boolean = route.name.includes('示例平台');
      if (!isPlatformRoute) {
        const groups: DimGroup[] = getDimensionGroups(request);
        if (groups.length > 0) {
          let maxLength = 0;
          let maxWidth = 0;
          let maxHeight = 0;
          let perimeter = 0;
          let sumDimensions = 0;
          for (const g of groups) {
            if (g.length && g.width && g.height) {
              maxLength = Math.max(maxLength, g.length, g.width, g.height);
              maxWidth = Math.max(maxWidth, g.width);
              maxHeight = Math.max(maxHeight, g.height);
              perimeter = Math.max(perimeter, 2 * (g.length + g.width) + g.height);
              sumDimensions += g.length + g.width + g.height;
            }
          }
          if (route.longestSideLimit) {
            const limit: number = Number(route.longestSideLimit);
            if (maxLength > limit) continue;
          }
          if (route.sumDimensionLimit) {
            const limit: number = Number(route.sumDimensionLimit);
            if (sumDimensions > limit) continue;
          }
          if (route.perimeterLimit) {
            const limitStr: string = String(route.perimeterLimit).replace(/[^\d.]/g, '');
            const limit: number = Number(limitStr);
            if (!isNaN(limit) && limit > 0 && perimeter > limit) continue;
          }
          if (route.lengthLimit) {
            const limit: number = Number(route.lengthLimit);
            if (!isNaN(limit) && limit > 0 && maxLength > limit) continue;
          }
          if (route.widthLimit) {
            const limit: number = Number(route.widthLimit);
            if (!isNaN(limit) && limit > 0 && maxWidth > limit) continue;
          }
          if (route.heightLimit) {
            const limit: number = Number(route.heightLimit);
            if (!isNaN(limit) && limit > 0 && maxHeight > limit) continue;
          }
        }
      }

      candidateRouteIds.push(route.id);
      if (route.routeCode) candidateRouteCodes.push(route.routeCode);
    }

    this.logger.log(`通过品类/包装/尺寸过滤后候选线路 ${candidateRouteIds.length} 条，开始批量加载 pricing_rule`);

    const rulesByRouteId: Map<string, PricingRuleRow[]> = new Map();
    if (candidateRouteIds.length > 0) {
      const candidateIdSet = new Set(candidateRouteIds);
      const candidateCodeSet = new Set(candidateRouteCodes);

      const routeByCode = new Map<string, ActiveRouteRow>();
      const routeById = new Map<string, ActiveRouteRow>();
      for (const route of activeRoutes) {
        if (route.routeCode) routeByCode.set(route.routeCode, route);
        routeById.set(route.id, route);
      }

      let matchedRuleCount = 0;
      for (const r of cache.allPricingRules) {
        const matchesById = r.routeId && candidateIdSet.has(r.routeId);
        const matchesByCode = r.routeCode && candidateCodeSet.has(r.routeCode);
        if (!matchesById && !matchesByCode) continue;

        let matchedRoute = r.routeCode ? routeByCode.get(r.routeCode) : undefined;
        if (!matchedRoute && r.routeId) matchedRoute = routeById.get(r.routeId);
        if (!matchedRoute) continue;
        matchedRuleCount++;
        const key: string = matchedRoute.id;
        const bucket = rulesByRouteId.get(key);
        if (bucket) {
          bucket.push(r);
        } else {
          rulesByRouteId.set(key, [r]);
        }
      }

      this.logger.log(`从缓存过滤 ${matchedRuleCount} 条 pricing_rule，分布于 ${rulesByRouteId.size} 个路线（route_code 优先匹配）`);
    }

    for (const routeId of candidateRouteIds) {
      const route = activeRoutes.find((r) => r.id === routeId);
      if (!route) continue;
      const billingMode = normalizeBillingMode(route.billingMode);
      const routeGroups: DimGroup[] = getDimensionGroups(request);
      const isPostalRoute: boolean = route.name.includes('EMS') || route.name.includes('ems') || route.name.includes('e特快');

      let routeVolumetricWeight: number = 0;
      if ((billingMode === 'volumetric_weight' || billingMode === 'max_both') && routeGroups.length > 0) {
        routeVolumetricWeight = calcVolumetricWeight(routeGroups, 6000, isPostalRoute, request.packagingType);
      }

      let routeEffectiveWeight: number = actualWeight;
      if (billingMode === 'volumetric_weight') {
        routeEffectiveWeight = routeVolumetricWeight > 0 ? routeVolumetricWeight : actualWeight;
      } else if (billingMode === 'max_both') {
        routeEffectiveWeight = Math.max(actualWeight, routeVolumetricWeight);
      } else if (billingMode === 'volume') {
        routeEffectiveWeight = actualWeight;
      }
      let totalWeight: number = routeEffectiveWeight;

      const rules: PricingRuleRow[] = rulesByRouteId.get(route.id) ?? [];

      let bestPrice: number | null = null;
      let bestPriority: number = -1;
      let bestDetail: InquiryPriceDetail | null = null;
      let bestRemark: string = '';
      let bestPriceNote: string = '';

      for (const rule of rules) {
        const minW: number = parseFloat(rule.minWeight);
        const maxW: number = parseFloat(rule.maxWeight);
        const hasWeightRange: boolean = Number.isFinite(minW) && Number.isFinite(maxW);
        const rulePriority: number = hasWeightRange ? 1 : 0;
        const hasMinWeight: boolean = Number.isFinite(minW) && minW > 0;
        const hasMaxWeight: boolean = Number.isFinite(maxW) && maxW > 0;
        const isRangePrice = rule.ruleType === 'range_price';

        let ruleVolumetricWeight: number = 0;
        if ((billingMode === 'volumetric_weight' || billingMode === 'max_both' || isRangePrice) && routeGroups.length > 0) {
          ruleVolumetricWeight = calcVolumetricWeight(routeGroups, 6000, isPostalRoute, request.packagingType);
        }

        let effectiveWeight: number = actualWeight;
        if (billingMode === 'volumetric_weight') {
          effectiveWeight = ruleVolumetricWeight > 0 ? ruleVolumetricWeight : actualWeight;
        } else if (billingMode === 'max_both') {
          effectiveWeight = Math.max(actualWeight, ruleVolumetricWeight);
        } else if (isRangePrice && ruleVolumetricWeight > 0) {
          effectiveWeight = Math.max(actualWeight, ruleVolumetricWeight);
        }
        totalWeight = effectiveWeight;

        if (hasMinWeight && totalWeight < minW) continue;
        if (hasMaxWeight && totalWeight > maxW) continue;

        if (!matchCountry(rule.countries, route.coverCountries, request.country)) continue;
        if (!matchZipCode(rule.zipCodeRanges, rule.applicableRegions, request.postalCode)) continue;

        let result: { price: number; weightCharge: number; unitPriceVal: number | null; fwpVal: number | null; cwpVal: number | null; formulaLines: string[] } | null = null;
        let effectiveMode: BillingMode | 'volume' = 'per_kg';
        const parsedUnit = parseBillingUnit(rule.unitPriceUnit);
        const isTicketRule = parsedUnit.unit === 'ticket' || (parsedUnit.unit === 'unknown' && billingMode === 'ticket');
        const isCbmRule = parsedUnit.unit === 'cbm' || (parsedUnit.unit === 'unknown' && billingMode === 'volume');
        if (isRangePrice && rule.unitPrice) {
          const rpRate: number = getRuleCurrencyRate(rule.unitPriceUnit, route.currency);
          const rpRaw: number = parseFloat(rule.unitPrice);
          if (Number.isFinite(rpRaw)) {
            const rpMinChargeParsed: number = parseFloat(rule.minCharge);
            const rpMinCharge: number = Number.isFinite(rpMinChargeParsed) ? rpMinChargeParsed : 0;
            const rpFixed: number = rpRaw * rpRate;
            const rpFinal: number = Math.max(rpFixed, rpMinCharge);
            const rpCurSym: string = rpRate !== 1 ? '\u0024' : '\u00a5';
            const rpRateSuffix: string = rpRate !== 1 ? ` \u00d7 ${rpRate}(\u6c47\u7387)` : '';
            const rpRangeLabel: string = `${rule.minWeight ?? '?'}-${rule.maxWeight ?? '?'}kg`;
            const rpTw: string = totalWeight.toFixed(2);
            const rpWeightLabel: string = ruleVolumetricWeight > actualWeight
              ? `max(实重 ${actualWeight.toFixed(2)}kg, 体积重 ${ruleVolumetricWeight.toFixed(2)}kg) = ${rpTw}kg`
              : `${rpTw}kg`;
            const formulaLines: string[] = [
              `计费重量: ${rpWeightLabel}（匹配区间 ${rpRangeLabel}）`,
              `固定区间价 = ${rpCurSym}${rpRaw.toFixed(2)}${rpRateSuffix} = ¥${rpFixed.toFixed(2)}`,
            ];
            if (rpMinCharge > rpFixed) formulaLines.push(`\u4f4e\u4e8e\u6700\u4f4e\u8d77\u8fd0\u8d39\u00a5${rpMinCharge.toFixed(2)}\uff0c\u6309\u6700\u4f4e\u8d77\u8fd0\u8d39\u8ba1`);
            formulaLines.push(`\u8fd0\u8d39\u5c0f\u8ba1: \u00a5${rpFinal.toFixed(2)}`);
            result = { price: rpFinal, weightCharge: rpFixed, unitPriceVal: rpFixed, fwpVal: null, cwpVal: null, formulaLines };
            effectiveMode = 'range_price';
          }
        } else if (isTicketRule) {
          const ruleRate: number = getRuleCurrencyRate(rule.unitPriceUnit, route.currency);
          result = calculatePrice('per_ticket', totalWeight, rule, ruleRate, request.quantity);
          effectiveMode = 'per_ticket';
        } else if (isCbmRule) {
          const cbm: number = calcCbmVolume(routeGroups, request.packagingType);
          if (cbm > 0 && rule.unitPrice) {
            const cbmRate: number = getRuleCurrencyRate(rule.unitPriceUnit, route.currency);
            const upRaw: number = parseFloat(rule.unitPrice);
            const up: number = upRaw * cbmRate;
            const charge: number = up * cbm;
            const minChargeNum: number = parseFloat(rule.minCharge || '');
            const effectiveMinCharge: number = (Number.isFinite(minChargeNum) && minChargeNum > 0) ? minChargeNum : up;
            const finalPrice: number = Math.max(charge, effectiveMinCharge);
            const curSym: string = cbmRate !== 1 ? '$' : '¥';
            const rateSuffix: string = cbmRate !== 1 ? ` × ${cbmRate}(汇率)` : '';
            const formulaLines: string[] = [
              `体积: ${cbm.toFixed(4)} CBM`,
              `运费 = ${curSym}${upRaw.toFixed(2)}/CBM × ${cbm.toFixed(4)} CBM${rateSuffix} = ¥${charge.toFixed(2)}`,
            ];
            if (effectiveMinCharge > charge) {
              const minLabel = (Number.isFinite(minChargeNum) && minChargeNum > 0)
                ? `最低起运费¥${minChargeNum.toFixed(2)}`
                : `最低1CBM收费¥${up.toFixed(2)}`;
              formulaLines.push(`低于${minLabel}，按最低收费计`);
            }
            formulaLines.push(`运费小计: ¥${finalPrice.toFixed(2)}`);
            result = { price: finalPrice, weightCharge: charge, unitPriceVal: up, fwpVal: null, cwpVal: null, formulaLines };
            effectiveMode = 'volume';
          }
        } else {
          const detectedMode: BillingMode = detectBillingMode(route.name, rule);
          const ruleRate: number = getRuleCurrencyRate(rule.unitPriceUnit, route.currency);
          result = calculatePrice(detectedMode, totalWeight, rule, ruleRate, request.quantity);
          effectiveMode = detectedMode;
          if (!result) {
            for (const fallbackMode of ALL_BILLING_MODES) {
              if (fallbackMode === detectedMode) continue;
              result = calculatePrice(fallbackMode, totalWeight, rule, ruleRate, request.quantity);
              if (result) { effectiveMode = fallbackMode; break; }
            }
          }
        }
        if (!result) continue;

        if (!Number.isFinite(result.price)) continue;
        if (result.price <= 0) continue;
        // Calculate surcharges for every rule to compare on total price
          const groups: DimGroup[] = getDimensionGroups(request);
          let finalVolumetricWeight: number = 0;
          if ((billingMode === 'volumetric_weight' || billingMode === 'max_both' || effectiveMode === 'range_price') && groups.length > 0) {
            finalVolumetricWeight = calcVolumetricWeight(groups, 6000, isPostalRoute, request.packagingType);
          }
          let finalEffectiveWeight: number = actualWeight;
          if (billingMode === 'volumetric_weight') {
            finalEffectiveWeight = finalVolumetricWeight > 0 ? finalVolumetricWeight : actualWeight;
          } else if (billingMode === 'max_both') {
            finalEffectiveWeight = Math.max(actualWeight, finalVolumetricWeight);
          } else if (effectiveMode === 'range_price' && finalVolumetricWeight > 0) {
            finalEffectiveWeight = Math.max(actualWeight, finalVolumetricWeight);
          }
          const usedVolumetric: boolean = (billingMode !== 'actual_weight' && billingMode !== 'ticket' || effectiveMode === 'range_price') && finalEffectiveWeight > actualWeight;
          const billingModeLabel: string = effectiveMode === 'per_ticket'
            ? '按票计费'
            : effectiveMode === 'volume'
              ? '体积计费(CBM)'
              : billingMode === 'actual_weight'
                ? '实重计费'
                : billingMode === 'volumetric_weight'
                  ? '体积重计费'
                  : billingMode === 'volume'
                    ? '体积计费(CBM)'
                    : billingMode === 'ticket'
                      ? '按票计费'
                      : 'MAX(实重,体积重)';

          // 计算各项附加费
          let longestSide = 0;
          for (const g of groups) {
            if (g.length && g.width && g.height) {
              longestSide = Math.max(longestSide, g.length, g.width, g.height);
            }
          }
          let oversizeFee: { amount: number; description: string; perUnit: 'piece' | 'kg' | null } | null = null;
          const tieredOverLength = parseTieredSurcharge(rule.overLengthSurcharge, longestSide);
          if (tieredOverLength) {
            oversizeFee = tieredOverLength;
          } else {
            const overLengthCond = parseOverLengthCondition(rule.overLengthCondition);
            if (overLengthCond !== null && longestSide > overLengthCond) {
              const parsed = parseSimpleFee(rule.overLengthSurcharge);
              if (parsed) oversizeFee = { amount: parsed.amount, description: `最长边${longestSide}cm > 超长条件${rule.overLengthCondition}`, perUnit: parsed.perUnit };
            }
          }

          let overweightFee: { amount: number; description: string; perUnit: 'piece' | 'kg' | null } | null = null;
          const tieredOverWeight = parseTieredSurcharge(rule.overWeightSurcharge, request.weight);
          if (tieredOverWeight) {
            overweightFee = tieredOverWeight;
          } else {
            const overWeightCond = parseOverWeightCondition(rule.overWeightCondition);
            const singlePieceWeight = request.weight;
            if (overWeightCond !== null && singlePieceWeight > overWeightCond) {
              const parsed = parseSimpleFee(rule.overWeightSurcharge);
              if (parsed) overweightFee = { amount: parsed.amount, description: `实重${singlePieceWeight}kg > 超重条件${rule.overWeightCondition}`, perUnit: parsed.perUnit };
            }
          }
          const remoteFee = calcRemoteAreaSurcharge(request.postalCode, request.city, totalWeight, rule.remoteAreaSurcharge);
          const fuelFee = calcFuelSurcharge(result.price, rule.fuelSurcharge);

          // 收集所有非空附加费到统一列表
          const surchargeItems: SurchargeItem[] = [];

          if (oversizeFee && oversizeFee.amount > 0) {
            surchargeItems.push({ label: '超长附加费', amount: applySurchargeMultiplier(oversizeFee.amount, oversizeFee.perUnit, request.quantity, totalWeight), description: oversizeFee.description });
          }

          if (overweightFee && overweightFee.amount > 0) {
            surchargeItems.push({ label: '超重附加费', amount: applySurchargeMultiplier(overweightFee.amount, overweightFee.perUnit, request.quantity, totalWeight), description: overweightFee.description });
          }

          if (remoteFee && remoteFee.amount > 0) {
            surchargeItems.push({ label: '偏远地区附加费', amount: remoteFee.amount, description: remoteFee.description });
          } else if (!remoteFee && rule.remoteAreaSurcharge) {
            const parsed = parseSimpleFee(rule.remoteAreaSurcharge);
            if (parsed) surchargeItems.push({ label: '偏远地区附加费', amount: applySurchargeMultiplier(parsed.amount, parsed.perUnit, request.quantity, totalWeight), description: parsed.raw });
          }

          if (fuelFee && fuelFee.amount > 0) {
            surchargeItems.push({ label: '燃油附加费', amount: fuelFee.amount, description: fuelFee.description });
          } else if (!fuelFee && rule.fuelSurcharge) {
            const parsed = parseSimpleFee(rule.fuelSurcharge);
            if (parsed) surchargeItems.push({ label: '燃油附加费', amount: applySurchargeMultiplier(parsed.amount, parsed.perUnit, request.quantity, totalWeight), description: parsed.raw });
          }

          const simpleFeeFields: Array<{ key: keyof PricingRuleRow; label: string }> = [
            { key: 'overPerimeterSurcharge', label: '超周长附加费' },
            { key: 'registrationFee', label: '挂号费' },
            { key: 'customsClearanceFee', label: '清关费' },
            { key: 'podFee', label: 'POD签收费' },
            { key: 'taxFee', label: '税费' },
          ];
          for (const field of simpleFeeFields) {
            if (field.key === 'customsClearanceFee' && request.customsType !== '需要单独报关') continue;
            const rawVal = rule[field.key] as string | null;
            const parsed = parseSimpleFee(rawVal);
            if (parsed) {
              surchargeItems.push({ label: field.label, amount: applySurchargeMultiplier(parsed.amount, parsed.perUnit, request.quantity, totalWeight), description: parsed.raw });
            }
          }
          if (request.packagingType === '需打木箱') {
            const parsed = parseSimpleFee(rule.woodenBoxPrice);
            if (parsed) surchargeItems.push({ label: '木箱包装费', amount: applySurchargeMultiplier(parsed.amount, parsed.perUnit, request.quantity, totalWeight), description: parsed.raw });
          }
          if (request.packagingType === '需打木架') {
            const parsed = parseSimpleFee(rule.woodenFramePrice);
            if (parsed) surchargeItems.push({ label: '木架包装费', amount: applySurchargeMultiplier(parsed.amount, parsed.perUnit, request.quantity, totalWeight), description: parsed.raw });
          }

          const totalSurcharges: number = surchargeItems.reduce((sum: number, item: SurchargeItem) => sum + item.amount, 0);

          const safeBase: number = Number.isFinite(result.price) ? result.price : 0;
          const totalPriceWithSurcharges = safeBase + totalSurcharges;

        const isBetter: boolean =
          bestPrice === null ||
          rulePriority > bestPriority ||
          (rulePriority === bestPriority &&
            totalPriceWithSurcharges < bestPrice);
        if (isBetter) {
          bestPrice = totalPriceWithSurcharges;
          bestPriority = rulePriority;
          const formulaLines: string[] = [];
          formulaLines.push(`计费模式: ${billingModeLabel}`);
          if (billingMode === 'actual_weight') {
            formulaLines.push(`计费重量 = 实重 ${actualWeight.toFixed(2)}kg`);
          } else if (groups.length > 0 && finalVolumetricWeight > 0) {
            formulaLines.push(`体积重计算:`);
            const needWoodenAdjust: boolean = request.packagingType === '需打木箱' || request.packagingType === '需打木架';
            if (needWoodenAdjust) {
              formulaLines.push(`  木箱/木架膨胀: 长宽各+5cm, 高+15cm`);
            }
            if (groups.length === 1) {
              const g = groups[0];
              const l = needWoodenAdjust ? g.length + 5 : g.length;
              const w = needWoodenAdjust ? g.width + 5 : g.width;
              const h = needWoodenAdjust ? g.height + 15 : g.height;
              formulaLines.push(`  ${l}×${w}×${h}cm × ${g.quantity}件 ÷ 6000 = ${finalVolumetricWeight.toFixed(3)}kg`);
            } else {
              let sum = 0;
              for (const g of groups) {
                const l = needWoodenAdjust ? g.length + 5 : g.length;
                const w = needWoodenAdjust ? g.width + 5 : g.width;
                const h = needWoodenAdjust ? g.height + 15 : g.height;
                const vol = l * w * h * g.quantity / 6000;
                sum += vol;
                formulaLines.push(`  ${l}×${w}×${h}cm × ${g.quantity}件 ÷ 6000 = ${vol.toFixed(3)}kg`);
              }
              formulaLines.push(`  总体积重 = ${sum.toFixed(3)}kg`);
            }
            if (billingMode === 'volumetric_weight') {
              formulaLines.push(`计费重量 = 体积重 ${finalVolumetricWeight.toFixed(3)}kg`);
            } else {
              formulaLines.push(`计费重量 = MAX(实重${actualWeight.toFixed(2)}kg, 体积重${finalVolumetricWeight.toFixed(3)}kg) = ${Math.max(actualWeight, finalVolumetricWeight).toFixed(2)}kg`);
            }
          }
          formulaLines.push(...result.formulaLines);

          for (const item of surchargeItems) {
            const desc = item.description ? ` (${item.description})` : '';
            formulaLines.push(`${item.label}: ¥${item.amount.toFixed(2)}${desc}`);
          }
          if (totalSurcharges > 0) {
            formulaLines.push(`附加费合计: ¥${totalSurcharges.toFixed(2)}`);
            formulaLines.push(`合计: ¥${totalPriceWithSurcharges.toFixed(2)}`);
          }

          bestDetail = {
            billingMode: billingModeLabel,
            unitPrice: result.unitPriceVal,
            firstWeightPrice: result.fwpVal,
            continuedWeightPrice: result.cwpVal,
            minCharge: parseFloat(rule.minCharge || '0') || 0,
            weightCharge: parseFloat(result.weightCharge.toFixed(2)),
            actualWeight,
            volumetricWeight: finalVolumetricWeight > 0 ? finalVolumetricWeight : undefined,
            usedVolumetricWeight: usedVolumetric,
            billingModeLabel,
            volumeWeightDivisor: billingMode !== 'actual_weight' && billingMode !== 'ticket' ? 6000 : null,
            volumetricCalculation: billingMode !== 'actual_weight' && billingMode !== 'ticket' && groups.length > 0 ? {
              length: groups[0].length,
              width: groups[0].width,
              height: groups[0].height,
              quantity: groups[0].quantity,
              divisor: 6000,
              volumetricWeight: finalVolumetricWeight,
              actualWeight,
              usedVolumetric,
              groups: groups.map((g: DimGroup) => ({ length: g.length, width: g.width, height: g.height, quantity: g.quantity })),
              adjustedGroups: groups.map((g: DimGroup) => {
                const needAdj = request.packagingType === '需打木箱' || request.packagingType === '需打木架';
                return {
                  length: needAdj ? g.length + 5 : g.length,
                  width: needAdj ? g.width + 5 : g.width,
                  height: needAdj ? g.height + 15 : g.height,
                  quantity: g.quantity,
                };
              }),
              hasWoodenAdjust: request.packagingType === '需打木箱' || request.packagingType === '需打木架',
            } : undefined,
            oversizeSurcharge: oversizeFee?.amount || undefined,
            overweightSurcharge: overweightFee?.amount || undefined,
            remoteAreaSurcharge: remoteFee?.amount || undefined,
            fuelSurcharge: fuelFee?.amount || undefined,
            surchargeTotal: surchargeItems.length > 0 ? parseFloat(totalSurcharges.toFixed(2)) : undefined,
            surchargeItems: surchargeItems.length > 0 ? surchargeItems : undefined,
            billingFormula: formulaLines,
          };
          bestRemark = rule.remark || '';
          bestPriceNote = buildPriceNote(route.name, effectiveMode, rule, totalWeight, actualWeight, finalVolumetricWeight, usedVolumetric);
          for (const item of surchargeItems) {
            bestPriceNote += ` | ${item.label}: ${item.amount.toFixed(2)}元`;
          }
        }
      }

      if (bestPrice !== null && bestDetail !== null) {
        if (bestPrice >= 100000) continue;
        const combinedRemark: string = [route.remark, bestRemark].filter((r: string) => r).join('；');
        const finalVolumetricWeight: number = (billingMode === 'volumetric_weight' || billingMode === 'max_both')
          ? calcVolumetricWeight(getDimensionGroups(request), 6000, isPostalRoute, request.packagingType)
          : 0;
        const paymentInfo = this.resolvePaymentInfo(route.providerName ?? null, paymentMap);
        matchedCandidates.push({
          routeId: route.id,
          routeName: route.name,
          providerName: route.providerName ?? null,
          channelType: (route.channelType as ChannelType) || 'sea',
          transportType: normalizeTransportType(route.transportType),
          lastMileDoor: route.lastMileDoor ?? null,
          totalPrice: Number.isFinite(bestPrice) ? parseFloat(bestPrice.toFixed(2)) : 0,
          minDeliveryDays: route.minDeliveryDays ?? null,
          maxDeliveryDays: route.maxDeliveryDays ?? null,
          paymentDays: 0,
          paymentTerm: paymentInfo?.paymentTerm || '无账期',
          cooperationCount: this.resolveCooperationCount(route.providerName ?? null, coopMap) ?? null,
          serviceType: normalizeServiceType(route.serviceType).type,
          serviceTypeLabel: normalizeServiceType(route.serviceType).label,
          priceDetail: bestDetail,
          remark: combinedRemark,
          priceNote: bestPriceNote,
          actualWeight,
          volumetricWeight: finalVolumetricWeight,
          usedVolumetric: billingMode !== 'actual_weight' && billingMode !== 'ticket' && finalVolumetricWeight > actualWeight,
          billingFormula: bestDetail.billingFormula || [],
        });
      }
    }

    this.logger.log(`匹配到 ${matchedCandidates.length} 条候选线路`);

    if (matchedCandidates.length === 0) {
      return { items: [] };
    }

    const MAX_RESULT_ITEMS: number = request.maxResults || 50;

    const scoredItems: InquiryResultItem[] = this.scoreAndRank(matchedCandidates);
    const completeRoutes: InquiryResultItem[] = scoredItems
      .filter((item: InquiryResultItem) => item.transportType === 'trunk_lastmile');
    const combinedItems: InquiryResultItem[] = this.generateCombinedRoutes(scoredItems);

    const finalItems: InquiryResultItem[] = [...completeRoutes, ...combinedItems];
    if (finalItems.length > 0) {
      return { items: finalItems.slice(0, MAX_RESULT_ITEMS) };
    }
    return { items: scoredItems.slice(0, MAX_RESULT_ITEMS) };
  }

  private scoreAndRank(candidates: MatchedCandidate[]): InquiryResultItem[] {
    const prices: number[] = candidates.map((c: MatchedCandidate) => c.totalPrice);
    const daysArr: number[] = candidates
      .map((c: MatchedCandidate) => c.maxDeliveryDays || c.minDeliveryDays)
      .filter((d: number | null): d is number => d !== null && d > 0);
    const coopArr: number[] = candidates
      .map((c: MatchedCandidate) => c.cooperationCount || 0);
    const paymentArr: number[] = candidates
      .map((c: MatchedCandidate) => c.paymentDays || 0);

    const minPrice: number = Math.min(...prices);
    const minDays: number = daysArr.length > 0 ? Math.min(...daysArr) : 1;
    const maxCoop: number = Math.max(...coopArr, 1);
    const maxPayment: number = Math.max(...paymentArr, 1);

    const scored: InquiryResultItem[] = candidates.map((c: MatchedCandidate) => {
      const currentDays: number = c.maxDeliveryDays || c.minDeliveryDays || minDays;
      const coopCount: number = c.cooperationCount || 0;
      const payDays: number = c.paymentDays || 0;

      const priceScore: number = minPrice / (c.totalPrice || 1);
      const daysScore: number = minDays / currentDays;
      const coopScore: number = coopCount / maxCoop;
      const paymentScore: number = payDays / maxPayment;

      const score: number = priceScore * 0.45 + daysScore * 0.30 + coopScore * 0.15 + paymentScore * 0.10;

      return {
        routeId: c.routeId,
        routeName: c.routeName,
        providerName: c.providerName,
        channelType: c.channelType,
        transportType: c.transportType,
        lastMileDoor: c.lastMileDoor,
        lastMileDoorLabel: buildLastMileDoorLabel(c.lastMileDoor),
        totalPrice: c.totalPrice,
        minDeliveryDays: c.minDeliveryDays,
        maxDeliveryDays: c.maxDeliveryDays,
        score: parseFloat(score.toFixed(4)),
        tag: '',
        remark: c.remark,
        priceNote: c.priceNote,
        paymentDays: c.paymentDays,
        paymentTerm: c.paymentTerm || '无账期',
        cooperationCount: c.cooperationCount,
        serviceType: c.serviceType,
        serviceTypeLabel: c.serviceTypeLabel,
        priceDetail: {
          ...c.priceDetail,
          actualWeight: c.actualWeight,
          volumetricWeight: c.volumetricWeight,
          usedVolumetricWeight: c.usedVolumetric,
        },
        billingFormula: c.billingFormula,
      };
    });

    scored.sort((a: InquiryResultItem, b: InquiryResultItem) => b.score - a.score);

    const taggedRouteIds: Set<string> = new Set();

    if (scored.length > 0) {
      scored[0].tag = '综合推荐';
      taggedRouteIds.add(scored[0].routeId);
    }

    let fastestIdx: number = -1;
    let fastestDays: number = Infinity;
    let cheapestIdx: number = -1;
    let cheapestPrice: number = Infinity;
    for (let i = 0; i < scored.length; i++) {
      const days: number = scored[i].maxDeliveryDays || scored[i].minDeliveryDays;
      if (days > 0 && days < fastestDays) {
        fastestDays = days;
        fastestIdx = i;
      }
      if (scored[i].totalPrice < cheapestPrice) {
        cheapestPrice = scored[i].totalPrice;
        cheapestIdx = i;
      }
    }

    if (fastestIdx >= 0 && !taggedRouteIds.has(scored[fastestIdx].routeId)) {
      scored[fastestIdx].tag = '时效最优';
      taggedRouteIds.add(scored[fastestIdx].routeId);
    }

    if (cheapestIdx >= 0 && !taggedRouteIds.has(scored[cheapestIdx].routeId)) {
      scored[cheapestIdx].tag = '性价比首选';
      taggedRouteIds.add(scored[cheapestIdx].routeId);
    }

    return scored;
  }

  private generateCombinedRoutes(scoredItems: InquiryResultItem[]): InquiryResultItem[] {
    const trunkOnlyItems: InquiryResultItem[] = scoredItems
      .filter((item: InquiryResultItem) => item.transportType === 'international_trunk_only');
    const lastmileOnlyItems: InquiryResultItem[] = scoredItems
      .filter((item: InquiryResultItem) => item.transportType === 'overseas_lastmile_only');

    if (trunkOnlyItems.length === 0 || lastmileOnlyItems.length === 0) return [];

    const lastmileOnlyByForwarder: Map<string, InquiryResultItem[]> = new Map();
    for (const lm of lastmileOnlyItems) {
      const fwd: string = lm.providerName || '';
      if (!lastmileOnlyByForwarder.has(fwd)) lastmileOnlyByForwarder.set(fwd, []);
      lastmileOnlyByForwarder.get(fwd)!.push(lm);
    }

    const combined: InquiryResultItem[] = [];
    for (const trunk of trunkOnlyItems) {
      const fwd: string = trunk.providerName || '';
      const matchingLastmile: InquiryResultItem[] = lastmileOnlyByForwarder.get(fwd) || [];
      if (matchingLastmile.length === 0) continue;

      for (const lm of matchingLastmile) {
        const totalPrice: number = parseFloat((trunk.totalPrice + lm.totalPrice).toFixed(2));
        const minDays: number = (trunk.minDeliveryDays || 0) + (lm.minDeliveryDays || 0);
        const maxDays: number = (trunk.maxDeliveryDays || trunk.minDeliveryDays || 0)
          + (lm.maxDeliveryDays || lm.minDeliveryDays || 0);

        const trunkInfo: CombinedRouteInfo = {
          routeId: trunk.routeId,
          routeName: trunk.routeName,
          totalPrice: trunk.totalPrice,
          minDeliveryDays: trunk.minDeliveryDays,
          maxDeliveryDays: trunk.maxDeliveryDays,
          transportType: 'international_trunk_only',
          priceDetail: trunk.priceDetail,
          billingFormula: trunk.billingFormula,
        };
        const lastmileInfo: CombinedRouteInfo = {
          routeId: lm.routeId,
          routeName: lm.routeName,
          totalPrice: lm.totalPrice,
          minDeliveryDays: lm.minDeliveryDays,
          maxDeliveryDays: lm.maxDeliveryDays,
          transportType: 'overseas_lastmile_only',
          priceDetail: { ...lm.priceDetail },
          billingFormula: lm.priceDetail.billingFormula,
        };

        const lmFormula: string[] = lm.priceDetail.billingFormula || [];
        const combinedFormula: string[] = [
          `【国际干线】${trunk.routeName}`,
          ...(trunk.billingFormula || []).map((line: string) => `  ${line}`),
          `【海外尾程】${lm.routeName}`,
          ...lmFormula.map((line: string) => `  ${line}`),
          `总价 = ¥${trunk.totalPrice.toFixed(2)} + ¥${lm.totalPrice.toFixed(2)} = ¥${totalPrice.toFixed(2)}`,
        ].filter(Boolean);

        const combinedLastMileDoor: boolean | null =
          trunk.lastMileDoor === true && lm.lastMileDoor === true
            ? true
            : (trunk.lastMileDoor === false || lm.lastMileDoor === false ? false : null);

        combined.push({
          routeId: `combined_${trunk.routeId}_${lm.routeId}`,
          routeName: `${trunk.routeName} + ${lm.routeName}`,
          providerName: trunk.providerName,
          channelType: trunk.channelType,
          transportType: 'combined',
          totalPrice,
          minDeliveryDays: minDays || null,
          maxDeliveryDays: maxDays || null,
          score: 0,
          tag: '',
          remark: '',
          priceNote: `国际干线: ${trunk.priceDetail.billingMode} ¥${trunk.totalPrice.toFixed(2)} | 海外尾程: ${lm.priceDetail.billingMode} ¥${lm.totalPrice.toFixed(2)}`,
          paymentDays: Math.max(trunk.paymentDays, lm.paymentDays),
          cooperationCount: trunk.cooperationCount,
          serviceType: trunk.serviceType,
          serviceTypeLabel: trunk.serviceTypeLabel,
          lastMileDoor: combinedLastMileDoor,
          lastMileDoorLabel: buildLastMileDoorLabel(combinedLastMileDoor),
          priceDetail: {
            billingMode: '组合计费',
            unitPrice: null,
            firstWeightPrice: null,
            continuedWeightPrice: null,
            minCharge: 0,
            weightCharge: totalPrice,
            actualWeight: trunk.priceDetail.actualWeight,
            volumetricWeight: trunk.priceDetail.volumetricWeight,
            usedVolumetricWeight: trunk.priceDetail.usedVolumetricWeight,
            freightCharge: parseFloat(((trunk.priceDetail.weightCharge || 0) + (lm.priceDetail.weightCharge || 0)).toFixed(2)),
            surchargeTotal: parseFloat((
              (trunk.priceDetail.surchargeTotal || 0)
              + (lm.priceDetail.surchargeTotal || 0)
            ).toFixed(2)),
            surchargeItems: [
              ...(trunk.priceDetail.surchargeItems || []).map((s: SurchargeItem) => ({ ...s, label: `国际干线·${s.label}` })),
              ...(lm.priceDetail.surchargeItems || []).map((s: SurchargeItem) => ({ ...s, label: `海外尾程·${s.label}` })),
            ],
            billingFormula: combinedFormula,
          },
          combinedFrom: { trunk: trunkInfo, lastmile: lastmileInfo },
        });
      }
    }

    if (combined.length === 0) return [];

    const allPrices: number[] = [...scoredItems, ...combined].map((i: InquiryResultItem) => i.totalPrice);
    const allDays: number[] = [...scoredItems, ...combined]
      .map((i: InquiryResultItem) => i.maxDeliveryDays || i.minDeliveryDays)
      .filter((d: number | null): d is number => d !== null && d > 0);
    const allCoop: number[] = [...scoredItems, ...combined].map((i: InquiryResultItem) => i.cooperationCount || 0);
    const allPayment: number[] = [...scoredItems, ...combined].map((i: InquiryResultItem) => i.paymentDays || 0);
    const minPrice: number = Math.min(...allPrices);
    const minDays: number = allDays.length > 0 ? Math.min(...allDays) : 1;
    const maxCoop: number = Math.max(...allCoop, 1);
    const maxPayment: number = Math.max(...allPayment, 1);

    for (const item of combined) {
      const currentDays: number = item.maxDeliveryDays || item.minDeliveryDays || minDays;
      const coopCount: number = item.cooperationCount || 0;
      const payDays: number = item.paymentDays || 0;
      const priceScore: number = minPrice / (item.totalPrice || 1);
      const daysScore: number = minDays / currentDays;
      const coopScore: number = coopCount / maxCoop;
      const paymentScore: number = payDays / maxPayment;
      item.score = parseFloat((priceScore * 0.45 + daysScore * 0.30 + coopScore * 0.15 + paymentScore * 0.10).toFixed(4));
    }

    combined.sort((a: InquiryResultItem, b: InquiryResultItem) => b.score - a.score);
    if (combined.length > 0) {
      combined[0].tag = '组合推荐';
    }

    return combined;
  }

  // 用户历史输入相关方法
  async getUserInputHistory(
    userId: string,
    fieldName: string,
  ): Promise<{ items: { fieldValue: string; inputCount: number; lastUsedAt: string }[] }> {
    if (!userId || !fieldName) {
      return { items: [] };
    }

    const result = await this.db.execute<Record<string, unknown>>(sql`
      SELECT field_value, input_count, last_used_at
      FROM user_input_history
      WHERE user_id = ${userId} AND field_name = ${fieldName}
      ORDER BY input_count DESC, last_used_at DESC
      LIMIT 10
    `);

    const rows = result as unknown as Array<{ field_value: string; input_count: number; last_used_at: string | Date }>;
    return {
      items: rows.map((row) => ({
        fieldValue: row.field_value,
        inputCount: row.input_count,
        lastUsedAt: typeof row.last_used_at === 'string'
          ? row.last_used_at
          : row.last_used_at.toISOString(),
      })),
    };
  }

  async saveUserInputHistory(
    userId: string,
    body: { records: { fieldName: string; fieldValue: string }[] },
  ): Promise<void> {
    if (!userId || !body.records || body.records.length === 0) {
      return;
    }

    // 统一时间戳，确保同一批数据分到同一组
    const batchTime = new Date().toISOString();

    for (const record of body.records) {
      if (!record.fieldName || !record.fieldValue) continue;

      // 每次提交都插入新记录，确保同一批次数据始终在同一行展示
      // 不在此处更新旧记录的时间戳，避免打乱历史分组
      await this.db.execute(sql`
        INSERT INTO user_input_history (user_id, field_name, field_value, input_count, last_used_at, _created_at, _updated_at)
        VALUES (${userId}, ${record.fieldName}, ${record.fieldValue}, 1, ${batchTime}, NOW(), NOW())
      `);
    }
  }

  async clearUserInputHistory(
    userId: string,
    fieldName?: string,
  ): Promise<void> {
    if (!userId) return;

    if (fieldName) {
      await this.db.execute(sql`
        DELETE FROM user_input_history
        WHERE user_id = ${userId} AND field_name = ${fieldName}
      `);
    } else {
      await this.db.execute(sql`
        DELETE FROM user_input_history
        WHERE user_id = ${userId}
      `);
    }
  }

  async getUserInputHistoryList(
    userId: string,
    page: number,
    pageSize: number,
   ): Promise<{ items: Array<{
     id: string;
     userId: string;
     country: string;
     city: string;
     weight: string;
     length: string;
     width: string;
     height: string;
     quantity: string;
     packagesCount: string;
     category: string;
     packagingType: string;
     postalCode: string;
     declaredValue: string;
     itemName: string;
     selectedRoute: string;
     lastUsedAt: string;
   }>; total: number }> {
    if (!userId) {
      return { items: [], total: 0 };
    }

    // 获取按时间分组的记录
    const timeGroupsResult = await this.db.execute<Record<string, unknown>>(sql`
      SELECT DISTINCT last_used_at
      FROM user_input_history
      WHERE user_id = ${userId}
      ORDER BY last_used_at DESC
      LIMIT ${pageSize}
      OFFSET ${(page - 1) * pageSize}
    `);

    const timeGroups = timeGroupsResult as unknown as Array<{ last_used_at: string | Date }>;

    if (timeGroups.length === 0) {
      return { items: [], total: 0 };
    }

    // 获取每个时间点的所有字段值
    const items: Array<{
      id: string;
      userId: string;
      country: string;
      city: string;
      weight: string;
      length: string;
      width: string;
      height: string;
      quantity: string;
      packagesCount: string;
      category: string;
      packagingType: string;
       postalCode: string;
       declaredValue: string;
       itemName: string;
       selectedRoute: string;
       lastUsedAt: string;
     }> = [];

    for (const group of timeGroups) {
      const timeValue = typeof group.last_used_at === 'string'
        ? group.last_used_at
        : group.last_used_at.toISOString();

      const recordsResult = await this.db.execute<Record<string, unknown>>(sql`
        SELECT id, field_name, field_value
        FROM user_input_history
        WHERE user_id = ${userId} AND last_used_at = ${timeValue}
      `);

      const records = recordsResult as unknown as Array<{ id: string; field_name: string; field_value: string }>;

      const row: Record<string, string> = {
        id: '',
        userId,
        country: '',
        city: '',
        weight: '',
        length: '',
        width: '',
        height: '',
        quantity: '',
        packagesCount: '',
        category: '',
        packagingType: '',
        postalCode: '',
         declaredValue: '',
         itemName: '',
         selectedRoute: '',
         lastUsedAt: timeValue,
      };

      for (const record of records) {
        if (!row.id) row.id = record.id;
        const fieldName = record.field_name as keyof typeof row;
        if (fieldName in row) {
          row[fieldName] = record.field_value;
        }
      }

      items.push(row as typeof items[0]);
    }

    // 获取总数
    const countResult = await this.db.execute<Record<string, unknown>>(sql`
      SELECT COUNT(DISTINCT last_used_at) as total
      FROM user_input_history
      WHERE user_id = ${userId}
    `);

    const total = (countResult as unknown as Array<{ total: number }>)[0]?.total || 0;

    return { items, total };
  }
}
