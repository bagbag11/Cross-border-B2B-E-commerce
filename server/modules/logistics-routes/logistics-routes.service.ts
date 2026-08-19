import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  CapabilityService,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { logisticsRoute, pricingRule } from '../../database/schema';
import { eq, and, ilike, sql, count, inArray, or } from 'drizzle-orm';
import type {
  LogisticsRouteListItem,
  LogisticsRouteDetail,
  PricingRuleItem,
  CreateLogisticsRouteRequest,
  UpdateLogisticsRouteRequest,
  CreatePricingRuleRequest,
  UpdatePricingRuleRequest,
} from '@shared/api.interface';

const DOMESTIC_KEYWORDS: string[] = [
  '卡派',
  '尾程',
  '海外仓仓租',
  '海外仓耗材',
  '海外仓增值',
  '官方仓送货',
  'FBS揽收',
  'FBS送仓',
  'FBO',
  '退件入仓',
  '上架服务',
  '邮政海外仓',
  '海外仓尾程',
  '快递派',
  '海卡卡派',
];

function classifyTransportType(name: string): string {
  for (const keyword of DOMESTIC_KEYWORDS) {
    if (name.includes(keyword)) {
      return '仅海外尾程派送';
    }
  }
  return '干线+尾程派送';
}

@Injectable()
export class LogisticsRoutesService {
  private readonly logger = new Logger(LogisticsRoutesService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE)
    private readonly db: PostgresJsDatabase,
    @Inject() private readonly capabilityService: CapabilityService,
  ) {}

  async getList(params: {
    country?: string;
    isActive?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: LogisticsRouteListItem[]; total: number }> {
    const { country, isActive, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (country) {
      conditions.push(ilike(logisticsRoute.coverCountries, `%${country}%`));
    }
    if (isActive !== undefined && isActive !== '') {
      conditions.push(eq(logisticsRoute.isActive, isActive));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const itemsResult = await this.db
      .select({
        id: logisticsRoute.id,
        name: logisticsRoute.name,
        coverCountries: logisticsRoute.coverCountries,
        coverCities: logisticsRoute.coverCities,
        isActive: logisticsRoute.isActive,
        providerName: logisticsRoute.providerName,
        updatedAt: logisticsRoute.updatedAt,
        updatedBy: sql<string>`COALESCE((${logisticsRoute.updatedBy}).user_id, '')`,
        pricingRuleCount: sql<number>`(
          SELECT COUNT(*) FROM pricing_rule pr
          WHERE pr.route_code = ${logisticsRoute.routeCode}
             OR pr.route_id = ${logisticsRoute.id}
        )`.as('pricing_rule_count'),
      })
      .from(logisticsRoute)
      .where(whereClause)
      .orderBy(logisticsRoute.createdAt)
      .limit(pageSize)
      .offset(offset);

    const totalResult = await this.db
      .select({ count: count() })
      .from(logisticsRoute)
      .where(whereClause);

    const total: number = Number(totalResult[0].count);

    const items: LogisticsRouteListItem[] = itemsResult.map(
      (row: {
        id: string;
        name: string;
        coverCountries: string;
        coverCities: string | null;
        isActive: string;
        providerName: string | null;
        updatedAt: Date;
        updatedBy: string;
        pricingRuleCount: number;
      }) => ({
        id: row.id,
        name: row.name,
        coverCountries: row.coverCountries,
        coverCities: row.coverCities || '',
        isActive: row.isActive,
        providerName: row.providerName ?? null,
        pricingRuleCount:
          typeof row.pricingRuleCount === 'string'
            ? parseInt(row.pricingRuleCount, 10)
            : row.pricingRuleCount,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
      }),
    );

    return { items, total };
  }

  async create(
    data: CreateLogisticsRouteRequest,
  ): Promise<{ id: string }> {
    const existing = await this.db
      .select({ id: logisticsRoute.id })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.name, data.name));

    if (existing.length > 0) {
      throw new ConflictException(
        `线路名称 "${data.name}" 已存在`,
      );
    }

    const result = await this.db
      .insert(logisticsRoute)
      .values({
        name: data.name,
        coverCountries: data.coverCountries,
        coverCities: data.coverCities || null,
        postalCodeRange: data.postalCodeRange || null,
        supportedCategories: data.supportedCategories || null,
        transportType: classifyTransportType(data.name),
        providerName: data.providerName ?? null,
        billingMode: data.billingMode ?? 'volumetric_weight',
        lastMileDoor: data.lastMileDoor ?? true,
        perimeterLimit: data.perimeterLimit ?? null,
        lengthLimit: data.lengthLimit ?? null,
        widthLimit: data.widthLimit ?? null,
        heightLimit: data.heightLimit ?? null,
        effectiveDate: data.effectiveDate ?? null,
        currency: data.currency ?? null,
        routeCode: data.routeCode ?? null,
        isActive: '启用',
      })
      .returning({ id: logisticsRoute.id });

    this.logger.log(
      `Created logistics route: ${result[0].id}`,
    );
    return { id: result[0].id };
  }

  async getDetail(id: string): Promise<LogisticsRouteDetail> {
    const routeResult = await this.db
      .select()
      .from(logisticsRoute)
      .where(eq(logisticsRoute.id, id));

    if (routeResult.length === 0) {
      throw new NotFoundException('线路不存在');
    }

    const route = routeResult[0];

    const rulesResult = await this.db
      .select()
      .from(pricingRule)
      .where(or(
        route.routeCode ? eq(pricingRule.routeCode, route.routeCode) : sql`false`,
        eq(pricingRule.routeId, id),
      ))
      .orderBy(pricingRule.minWeight);

    const pricingRules: PricingRuleItem[] = rulesResult.map(
      (rule: Record<string, unknown>) => ({
        id: rule.id as string,
        routeId: (rule.routeId as string) ?? null,
        minWeight: rule.minWeight != null ? parseFloat(rule.minWeight as string) : null,
        maxWeight: rule.maxWeight != null ? parseFloat(rule.maxWeight as string) : null,
        unitPrice: rule.unitPrice
          ? parseFloat(rule.unitPrice as string)
          : null,
        firstWeightPrice: rule.firstWeightPrice
          ? parseFloat(rule.firstWeightPrice as string)
          : null,
        continuedWeightPrice: rule.continuedWeightPrice
          ? parseFloat(rule.continuedWeightPrice as string)
          : null,
        minCharge: (rule.minCharge as string) ?? null,
        remark: (rule.remark as string) || '',
        countries: (rule.countries as string) ?? null,
        ruleType: (rule.ruleType as string) ?? null,
        routeName: (rule.routeName as string) ?? null,
        applicableRegions: (rule.applicableRegions as string) ?? null,
        zipCodeRanges: (rule.zipCodeRanges as string) ?? null,
        minLength: (rule.minLength as string) ?? null,
        maxLength: rule.maxLength ? parseFloat(rule.maxLength as string) : null,
        unitPriceUnit: (rule.unitPriceUnit as string) ?? null,
        firstWeightUnit: (rule.firstWeightUnit as string) ?? null,
        continuedWeightUnit: (rule.continuedWeightUnit as string) ?? null,
        overPerimeterSurcharge: (rule.overPerimeterSurcharge as string) ?? null,
        remoteAreaSurcharge: (rule.remoteAreaSurcharge as string) ?? null,
        overLengthSurcharge: (rule.overLengthSurcharge as string) ?? null,
        overWeightSurcharge: (rule.overWeightSurcharge as string) ?? null,
        overLengthCondition: (rule.overLengthCondition as string) ?? null,
        overWeightCondition: (rule.overWeightCondition as string) ?? null,
        registrationFee: (rule.registrationFee as string) ?? null,
        customsClearanceFee: (rule.customsClearanceFee as string) ?? null,
        podFee: (rule.podFee as string) ?? null,
        palletFee: (rule.palletFee as PricingRuleItem['palletFee']) ?? null,
        woodenBoxPrice: rule.woodenBoxPrice ? parseFloat(rule.woodenBoxPrice as string) : null,
        woodenFramePrice: rule.woodenFramePrice ? parseFloat(rule.woodenFramePrice as string) : null,
        fuelSurcharge: (rule.fuelSurcharge as string) ?? null,
        packageUnit: (rule.packageUnit as string) ?? null,
        taxFee: (rule.taxFee as string) ?? null,
        routeCode: (rule.routeCode as string) ?? null,
      }),
    );

    return {
      id: route.id,
      name: route.name,
      coverCountries: route.coverCountries,
      coverCities: route.coverCities || '',
      postalCodeRange: route.postalCodeRange || '',
      supportedCategories: route.supportedCategories || '',
      minDeliveryDays: route.minDeliveryDays ?? null,
      maxDeliveryDays: route.maxDeliveryDays ?? null,
      isActive: route.isActive,
      providerName: route.providerName ?? null,
      billingMode: route.billingMode as 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume',
      lastMileDoor: route.lastMileDoor ?? true,
      perimeterLimit: route.perimeterLimit ?? null,
      lengthLimit: route.lengthLimit != null ? Number(route.lengthLimit) : null,
      widthLimit: route.widthLimit != null ? Number(route.widthLimit) : null,
      heightLimit: route.heightLimit != null ? Number(route.heightLimit) : null,
      effectiveDate: route.effectiveDate ?? null,
      currency: route.currency ?? null,
      routeCode: route.routeCode ?? null,
      pricingRules,
    };
  }

  async updateBasicInfo(
    id: string,
    data: UpdateLogisticsRouteRequest,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: logisticsRoute.id })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('线路不存在');
    }

    if (data.name) {
      const nameConflict = await this.db
        .select({ id: logisticsRoute.id })
        .from(logisticsRoute)
        .where(
          and(
            eq(logisticsRoute.name, data.name),
            sql`${logisticsRoute.id} != ${id}`,
          ),
        );

      if (nameConflict.length > 0) {
        throw new ConflictException(
          `线路名称 "${data.name}" 已存在`,
        );
      }
    }

    await this.db
      .update(logisticsRoute)
      .set({
        name: data.name,
        coverCountries: data.coverCountries,
        coverCities: data.coverCities || null,
        postalCodeRange: data.postalCodeRange || null,
        supportedCategories: data.supportedCategories || null,
        providerName: data.providerName ?? null,
        billingMode: data.billingMode ?? 'volumetric_weight',
        lastMileDoor: data.lastMileDoor ?? true,
        perimeterLimit: data.perimeterLimit ?? null,
        lengthLimit: data.lengthLimit ?? null,
        widthLimit: data.widthLimit ?? null,
        heightLimit: data.heightLimit ?? null,
        effectiveDate: data.effectiveDate ?? null,
        currency: data.currency ?? null,
        routeCode: data.routeCode ?? null,
      })
      .where(eq(logisticsRoute.id, id));

    return { success: true };
  }

  async toggleStatus(
    id: string,
    isActive: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: logisticsRoute.id })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.id, id));

    if (existing.length === 0) {
      throw new NotFoundException('线路不存在');
    }

    await this.db
      .update(logisticsRoute)
      .set({ isActive })
      .where(eq(logisticsRoute.id, id));

    return { success: true };
  }

  async createPricingRule(
    routeId: string,
    data: CreatePricingRuleRequest,
  ): Promise<{ id: string }> {
    // 若传了 routeCode 则优先用其反查 route_id（可能替换外部传入的 routeId）
    let effectiveRouteId: string = routeId;
    if (data.routeCode != null && data.routeCode.trim()) {
      const matched = await this.db
        .select({ id: logisticsRoute.id })
        .from(logisticsRoute)
        .where(eq(logisticsRoute.routeCode, data.routeCode.trim()))
        .orderBy(sql`${logisticsRoute.isActive} DESC`, sql`${logisticsRoute.createdAt} DESC`)
        .limit(1);
      if (matched.length > 0) effectiveRouteId = matched[0].id;
    }

    const route = await this.db
      .select({ id: logisticsRoute.id })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.id, effectiveRouteId));

    if (route.length === 0) {
      throw new NotFoundException('线路不存在');
    }

    await this.checkWeightOverlap(
      effectiveRouteId,
      data.minWeight ?? null,
      data.maxWeight ?? null,
      undefined,
      data.countries || null,
      data.remark || null,
    );

    const result = await this.db
      .insert(pricingRule)
      .values({
        routeId: effectiveRouteId,
        minWeight: data.minWeight != null ? String(data.minWeight) : null,
        maxWeight: data.maxWeight != null ? String(data.maxWeight) : null,
        unitPrice: data.unitPrice != null
          ? String(data.unitPrice)
          : null,
        firstWeightPrice: data.firstWeightPrice != null
          ? String(data.firstWeightPrice)
          : null,
        continuedWeightPrice:
          data.continuedWeightPrice != null
            ? String(data.continuedWeightPrice)
            : null,
        minCharge: data.minCharge != null ? String(data.minCharge) : null,
        remark: data.remark || null,
        countries: data.countries || null,
        routeName: data.routeName ?? null,
        applicableRegions: data.applicableRegions ?? null,
        zipCodeRanges: data.zipCodeRanges ?? null,

        minLength: data.minLength != null ? String(data.minLength) : null,
        maxLength: data.maxLength != null ? String(data.maxLength) : null,
        unitPriceUnit: data.unitPriceUnit ?? 'kg',
        firstWeightUnit: data.firstWeightUnit ?? 'kg',
        continuedWeightUnit: data.continuedWeightUnit ?? 'kg',
        overPerimeterSurcharge: data.overPerimeterSurcharge ?? null,
        remoteAreaSurcharge: data.remoteAreaSurcharge ?? null,
        overLengthSurcharge: data.overLengthSurcharge ?? null,
        overWeightSurcharge: data.overWeightSurcharge ?? null,
        overLengthCondition: data.overLengthCondition ?? null,
        overWeightCondition: data.overWeightCondition ?? null,
        registrationFee: data.registrationFee != null ? String(data.registrationFee) : null,
        customsClearanceFee: data.customsClearanceFee != null ? String(data.customsClearanceFee) : null,
        podFee: data.podFee != null ? String(data.podFee) : null,
        palletFee: data.palletFee ?? null,
        woodenBoxPrice: data.woodenBoxPrice != null ? String(data.woodenBoxPrice) : null,
        woodenFramePrice: data.woodenFramePrice != null ? String(data.woodenFramePrice) : null,
        fuelSurcharge: data.fuelSurcharge ?? null,
        packageUnit: data.packageUnit ?? null,
        taxFee: data.taxFee ?? null,
        routeCode: data.routeCode ?? null,
      })
      .returning({ id: pricingRule.id });

    return { id: result[0].id };
  }

  async updatePricingRule(
    ruleId: string,
    data: UpdatePricingRuleRequest,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({
        id: pricingRule.id,
        routeId: pricingRule.routeId,
      })
      .from(pricingRule)
      .where(eq(pricingRule.id, ruleId));

    if (existing.length === 0) {
      throw new NotFoundException('报价规则不存在');
    }

    let routeId: string | null = existing[0].routeId;

    // 若传了 routeCode 且与当前 routeId 不同，重新反查
    if (data.routeCode != null && data.routeCode.trim()) {
      const matched = await this.db
        .select({ id: logisticsRoute.id })
        .from(logisticsRoute)
        .where(eq(logisticsRoute.routeCode, data.routeCode.trim()))
        .orderBy(sql`${logisticsRoute.isActive} DESC`, sql`${logisticsRoute.createdAt} DESC`)
        .limit(1);
      if (matched.length > 0) routeId = matched[0].id;
    }

    if (routeId) {
      await this.checkWeightOverlap(
        routeId,
        data.minWeight ?? null,
        data.maxWeight ?? null,
        ruleId,
      );
    }

    await this.db
      .update(pricingRule)
      .set({
        routeId: routeId ?? existing[0].routeId,
        minWeight: data.minWeight != null ? String(data.minWeight) : null,
        maxWeight: data.maxWeight != null ? String(data.maxWeight) : null,
        unitPrice: data.unitPrice != null
          ? String(data.unitPrice)
          : null,
        firstWeightPrice: data.firstWeightPrice != null
          ? String(data.firstWeightPrice)
          : null,
        continuedWeightPrice:
          data.continuedWeightPrice != null
            ? String(data.continuedWeightPrice)
            : null,
        minCharge: data.minCharge != null ? String(data.minCharge) : null,
        remark: data.remark || null,
        routeName: data.routeName ?? null,
        applicableRegions: data.applicableRegions ?? null,
        zipCodeRanges: data.zipCodeRanges ?? null,
        minLength: data.minLength != null ? String(data.minLength) : null,
        maxLength: data.maxLength != null ? String(data.maxLength) : null,
        unitPriceUnit: data.unitPriceUnit ?? 'kg',
        firstWeightUnit: data.firstWeightUnit ?? 'kg',
        continuedWeightUnit: data.continuedWeightUnit ?? 'kg',
        overPerimeterSurcharge: data.overPerimeterSurcharge ?? null,
        remoteAreaSurcharge: data.remoteAreaSurcharge ?? null,
        overLengthSurcharge: data.overLengthSurcharge ?? null,
        overWeightSurcharge: data.overWeightSurcharge ?? null,
        overLengthCondition: data.overLengthCondition ?? null,
        overWeightCondition: data.overWeightCondition ?? null,
        registrationFee: data.registrationFee != null ? String(data.registrationFee) : null,
        customsClearanceFee: data.customsClearanceFee != null ? String(data.customsClearanceFee) : null,
        podFee: data.podFee != null ? String(data.podFee) : null,
        palletFee: data.palletFee ?? null,
        woodenBoxPrice: data.woodenBoxPrice != null ? String(data.woodenBoxPrice) : null,
        woodenFramePrice: data.woodenFramePrice != null ? String(data.woodenFramePrice) : null,
        fuelSurcharge: data.fuelSurcharge ?? null,
        packageUnit: data.packageUnit ?? null,
        taxFee: data.taxFee ?? null,
        routeCode: data.routeCode ?? null,
      })
      .where(eq(pricingRule.id, ruleId));

    return { success: true };
  }

  async deletePricingRule(
    ruleId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: pricingRule.id })
      .from(pricingRule)
      .where(eq(pricingRule.id, ruleId));

    if (existing.length === 0) {
      throw new NotFoundException('报价规则不存在');
    }

    await this.db
      .delete(pricingRule)
      .where(eq(pricingRule.id, ruleId));

    return { success: true };
  }

  async deleteRoute(
    routeId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.db
      .select({ id: logisticsRoute.id, routeCode: logisticsRoute.routeCode })
      .from(logisticsRoute)
      .where(eq(logisticsRoute.id, routeId));

    if (existing.length === 0) {
      throw new NotFoundException('线路不存在');
    }

    const routeCode = existing[0].routeCode;
    await this.db
      .delete(pricingRule)
      .where(or(
        routeCode ? eq(pricingRule.routeCode, routeCode) : sql`false`,
        eq(pricingRule.routeId, routeId),
      ));
    await this.db
      .delete(logisticsRoute)
      .where(eq(logisticsRoute.id, routeId));

    return { success: true };
  }

  private async checkWeightOverlap(
    routeId: string,
    minWeight: number | null,
    maxWeight: number | null,
    excludeRuleId?: string,
    countries?: string | null,
    remark?: string | null,
  ): Promise<void> {
    // minWeight=null 视同 0；maxWeight=null 视同无穷大（99999）
    const conditions = [
      eq(pricingRule.routeId, routeId),
      sql`COALESCE(${pricingRule.minWeight}, 0)::numeric < ${maxWeight != null ? String(maxWeight) : '99999'}::numeric`,
      sql`COALESCE(${pricingRule.maxWeight}, 99999)::numeric > ${minWeight != null ? String(minWeight) : '0'}::numeric`,
    ];

    if (excludeRuleId) {
      conditions.push(sql`${pricingRule.id} != ${excludeRuleId}`);
    }

    if (countries) {
      conditions.push(eq(pricingRule.countries, countries));
    } else {
      conditions.push(sql`${pricingRule.countries} IS NULL`);
    }

    if (remark) {
      conditions.push(eq(pricingRule.remark, remark));
    } else {
      conditions.push(sql`${pricingRule.remark} IS NULL`);
    }

    const overlapping = await this.db
      .select({ id: pricingRule.id })
      .from(pricingRule)
      .where(and(...conditions));

    if (overlapping.length > 0) {
      throw new ConflictException(
        '重量段与现有规则重叠',
      );
    }
  }

  async recalculateTransportTypes(): Promise<{ updated: number; total: number }> {
    const allRoutes = await this.db
      .select({ id: logisticsRoute.id, name: logisticsRoute.name, transportType: logisticsRoute.transportType })
      .from(logisticsRoute);

    let updated = 0;
    for (const route of allRoutes) {
      const correctType = classifyTransportType(route.name);
      if (route.transportType !== correctType) {
        await this.db
          .update(logisticsRoute)
          .set({ transportType: correctType })
          .where(eq(logisticsRoute.id, route.id));
        updated++;
      }
    }

    this.logger.log(
      `Transport type recalculation: ${updated}/${allRoutes.length} routes updated`,
    );
    return { updated, total: allRoutes.length };
  }

  async syncToBitable(): Promise<{
    synced: number;
    added: number;
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const PLUGIN_ID = 'logistics_route_quote_bitable_sync_1';
    const BATCH_SIZE = 500;
    const errors: string[] = [];

    const allRoutes = await this.db
      .select()
      .from(logisticsRoute)
      .where(eq(logisticsRoute.isActive, '启用'));

    this.logger.log(`[syncToBitable] 读取到 ${allRoutes.length} 条启用线路`);

    if (allRoutes.length === 0) {
      return { synced: 0, added: 0, updated: 0, failed: 0, errors: ['没有启用的线路可同步'] };
    }

    const CHANNEL_MAP: Record<string, string> = {
      air: '空运', sea: '海运', land: '陆运', warehouse: '仓储',
    };
    const TRANSPORT_MAP: Record<string, string> = {
      '干线+尾程派送': '干线+尾程派送',
      '仅国际干线': '仅国际干线',
      '仅海外尾程派送': '仅海外尾程派送',
      combined: '组合',
      domestic: '境内派送',
      cross_border: '跨境运输',
    };

    const mapRouteToRecord = (route: typeof allRoutes[number]) => ({
      '线路名称，格式：物流商+线路名称': route.name,
      '@description 覆盖国家/地区，逗号分隔': route.coverCountries || '',
      '@description 覆盖城市，逗号分隔': route.coverCities || '',
      '@description 支持邮编范围': route.postalCodeRange || '',
      '@description 支持物品类别，逗号分隔': route.supportedCategories || '',
      '@description 最小物流时长（天）': route.minDeliveryDays != null ? String(route.minDeliveryDays) : '',
      '@description 最大物流时长（天）': route.maxDeliveryDays != null ? String(route.maxDeliveryDays) : '',
      '是否启用': route.isActive || '启用',
      '渠道类型': CHANNEL_MAP[route.channelType || ''] || route.channelType || '',
      '运输类型（境内派送or跨境运输）': TRANSPORT_MAP[route.transportType || ''] || route.transportType || '',
      '线路级别的附加说明或备注': route.remark || '',
    });

    const existingMap = new Map<string, string>();
    let pageToken: string | undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        const searchResult = await this.capabilityService
          .load(PLUGIN_ID)
          .call('searchRecords', {
            pageSize: 500,
            pageToken,
            fieldNames: ['线路名称，格式：物流商+线路名称'],
          }) as {
            records: Array<{ id: string; record: Record<string, { text?: string }> }>;
            hasMore: boolean;
            pageToken?: string;
          };

        for (const rec of searchResult.records) {
          const nameField = rec.record['线路名称，格式：物流商+线路名称'];
          const name = nameField?.text || '';
          if (name) {
            existingMap.set(name, rec.id);
          }
        }

        hasMore = searchResult.hasMore;
        pageToken = searchResult.pageToken;
      }
      this.logger.log(`[syncToBitable] 多维表格已有 ${existingMap.size} 条记录`);
    } catch (searchError) {
      this.logger.error('searchRecords failed', {
        pluginInstanceId: PLUGIN_ID,
        actionKey: 'searchRecords',
        error: searchError instanceof Error ? searchError.message : 'Unknown error',
      });
      errors.push(`查询已有记录失败: ${searchError instanceof Error ? searchError.message : '未知错误'}`);
      return { synced: 0, added: 0, updated: 0, failed: allRoutes.length, errors };
    }

    const toAdd: Array<{ record: Record<string, string> }> = [];
    const toUpdate: Array<{ id: string; record: Record<string, string> }> = [];

    for (const route of allRoutes) {
      const mapped = mapRouteToRecord(route);
      const existingId = existingMap.get(route.name);
      if (existingId) {
        toUpdate.push({ id: existingId, record: mapped });
      } else {
        toAdd.push({ record: mapped });
      }
    }

    let addedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
      const batch = toAdd.slice(i, i + BATCH_SIZE);
      try {
        const result = await this.capabilityService
          .load(PLUGIN_ID)
          .call('batchAddRecords', { records: batch }) as { records: Array<{ id: string }> };
        addedCount += result.records.length;
        this.logger.log(`[syncToBitable] 批量新增 ${result.records.length} 条成功`);
      } catch (addError) {
        const errMsg = addError instanceof Error ? addError.message : 'Unknown error';
        this.logger.error('batchAddRecords failed', {
          pluginInstanceId: PLUGIN_ID,
          actionKey: 'batchAddRecords',
          batchSize: batch.length,
          error: errMsg,
        });
        failedCount += batch.length;
        errors.push(`批量新增第${Math.floor(i / BATCH_SIZE) + 1}批失败: ${errMsg}`);
      }
    }

    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      try {
        const result = await this.capabilityService
          .load(PLUGIN_ID)
          .call('batchUpdateRecords', { records: batch }) as { records: Array<{ id: string }> };
        updatedCount += result.records.length;
        this.logger.log(`[syncToBitable] 批量更新 ${result.records.length} 条成功`);
      } catch (updateError) {
        const errMsg = updateError instanceof Error ? updateError.message : 'Unknown error';
        this.logger.error('batchUpdateRecords failed', {
          pluginInstanceId: PLUGIN_ID,
          actionKey: 'batchUpdateRecords',
          batchSize: batch.length,
          error: errMsg,
        });
        failedCount += batch.length;
        errors.push(`批量更新第${Math.floor(i / BATCH_SIZE) + 1}批失败: ${errMsg}`);
      }
    }

    this.logger.log(`[syncToBitable] 完成: 新增${addedCount} 更新${updatedCount} 失败${failedCount}`);

    return {
      synced: addedCount + updatedCount,
      added: addedCount,
      updated: updatedCount,
      failed: failedCount,
      errors,
    };
  }

  private normalizeBillingMode(raw: unknown): 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume' {
    if (raw == null || raw === '') return 'volumetric_weight';
    const s = String(raw).trim();
    if (!s) return 'volumetric_weight';
    const lower = s.toLowerCase();
    if (lower === 'cbm' || lower === '体积计费' || lower === 'volume' || lower === '按体积' || lower === 'by_volume') return 'volume';
    if (lower === 'max_both' || lower === '按体积重与实重取大' || lower === '取大' || lower === '实重与体积重取大') return 'max_both';
    if (lower === 'actual_weight' || lower === '按实重' || lower === '实重计费') return 'actual_weight';
    if (lower === 'volumetric_weight' || lower === '按体积重' || lower === '体积重计费') return 'volumetric_weight';
    return 'volumetric_weight';
  }

  async batchUpsertFromJson(data: {
    provider: string;
    routes: Array<Record<string, unknown> & { pricingRules?: Array<Record<string, unknown>> }>;
  }): Promise<{
    provider: string;
    created: number;
    updated: number;
    rulesInserted: number;
    rulesDeleted: number;
    errors: Array<{ name: string; error: string }>;
  }> {
    const { provider, routes } = data;
    let created = 0;
    let updated = 0;
    let rulesInserted = 0;
    let rulesDeleted = 0;
    const errors: Array<{ name: string; error: string }> = [];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const inputRouteCodes: string[] = [];
    const inputRouteNames: string[] = [];
    for (const routeJson of routes) {
      const rc = routeJson.routeCode ? String(routeJson.routeCode).trim() : '';
      const rn = String(routeJson.name || '');
      if (rc) inputRouteCodes.push(rc);
      if (rn) inputRouteNames.push(rn);
    }
    const uniqueRouteCodes = Array.from(new Set(inputRouteCodes));
    const uniqueRouteNames = Array.from(new Set(inputRouteNames));

    type ExistingRoute = { id: string; routeCode: string | null; name: string };
    let preloaded: ExistingRoute[] = [];
    if (uniqueRouteCodes.length > 0 || uniqueRouteNames.length > 0) {
      const orConds = [];
      if (uniqueRouteCodes.length > 0) orConds.push(inArray(logisticsRoute.routeCode, uniqueRouteCodes));
      if (uniqueRouteNames.length > 0) orConds.push(inArray(logisticsRoute.name, uniqueRouteNames));
      preloaded = await this.db
        .select({ id: logisticsRoute.id, routeCode: logisticsRoute.routeCode, name: logisticsRoute.name })
        .from(logisticsRoute)
        .where(orConds.length === 1 ? orConds[0] : or(...orConds));
    }
    const routeIdByCode: Map<string, string> = new Map();
    const routeIdByName: Map<string, string> = new Map();
    for (const r of preloaded) {
      if (r.routeCode) routeIdByCode.set(r.routeCode, r.id);
      routeIdByName.set(r.name, r.id);
    }
    this.logger.log(`batchUpsertFromJson [${provider}]: preloaded ${preloaded.length} existing routes (codes=${uniqueRouteCodes.length}, names=${uniqueRouteNames.length})`);

    const upsertedRouteIds: string[] = [];
    const perRouteResults: Array<{ routeId: string; rules: Array<Record<string, unknown>>; name: string }> = [];

    for (const routeJson of routes) {
      try {
        const routeName = String(routeJson.name || '');
        const routeCode = routeJson.routeCode ? String(routeJson.routeCode).trim() : '';
        if (!routeName && !routeCode) {
          errors.push({ name: '(unnamed)', error: 'missing name and routeCode' });
          continue;
        }
        const pricingRules = (routeJson.pricingRules as Array<Record<string, unknown>>) || [];

        let routeId: string | null = null;
        if (routeCode && routeIdByCode.has(routeCode)) routeId = routeIdByCode.get(routeCode)!;
        else if (routeName && routeIdByName.has(routeName)) routeId = routeIdByName.get(routeName)!;

        const commonSet = {
          coverCountries: String(routeJson.coverCountries || ''),
          coverCities: routeJson.coverCities ? String(routeJson.coverCities) : null,
          postalCodeRange: routeJson.postalCodeRange ? String(routeJson.postalCodeRange) : null,
          supportedCategories: routeJson.supportedCategories ? String(routeJson.supportedCategories) : null,
          channelType: routeJson.channelType ? String(routeJson.channelType) : null,
          transportType: routeJson.transportType ? String(routeJson.transportType) : '干线+尾程派送',
          serviceType: routeJson.serviceType ? String(routeJson.serviceType) : 'unknown',
          providerName: routeJson.providerName ? String(routeJson.providerName) : null,
          minDeliveryDays: routeJson.minDeliveryDays != null ? Number(routeJson.minDeliveryDays) : null,
          maxDeliveryDays: routeJson.maxDeliveryDays != null ? Number(routeJson.maxDeliveryDays) : null,
          currency: routeJson.currency ? String(routeJson.currency) : 'CNY',
          billingMode: this.normalizeBillingMode(routeJson.billingMode),
          lastMileDoor: routeJson.lastMileDoor !== false,
          perimeterLimit: routeJson.perimeterLimit ? String(routeJson.perimeterLimit) : null,
          lengthLimit: routeJson.lengthLimit != null ? Number(routeJson.lengthLimit) : null,
          widthLimit: routeJson.widthLimit != null ? Number(routeJson.widthLimit) : null,
          heightLimit: routeJson.heightLimit != null ? Number(routeJson.heightLimit) : null,
          effectiveDate: routeJson.effectiveDate ? String(routeJson.effectiveDate) : null,
          packagingRestriction: routeJson.packagingRestriction ? String(routeJson.packagingRestriction) : null,
          remark: routeJson.remark ? String(routeJson.remark) : null,
          routeCode: routeCode || null,
          isActive: routeJson.isActive === '禁用' ? '禁用' : '启用',
        };

        if (routeId) {
          const upd = await this.db
            .update(logisticsRoute)
            .set(commonSet)
            .where(eq(logisticsRoute.id, routeId))
            .returning({ id: logisticsRoute.id });
          if (upd.length === 0) {
            errors.push({ name: routeName || routeCode, error: 'update returned 0 rows (concurrent delete?)' });
            continue;
          }
          updated++;
        } else {
          const inserted = await this.db
            .insert(logisticsRoute)
            .values({ name: routeName, ...commonSet })
            .returning({ id: logisticsRoute.id });
          routeId = inserted[0].id;
          if (routeCode) routeIdByCode.set(routeCode, routeId);
          routeIdByName.set(routeName, routeId);
          created++;
        }

        upsertedRouteIds.push(routeId);
        perRouteResults.push({ routeId, rules: pricingRules, name: routeName || routeCode });
      } catch (e) {
        errors.push({
          name: String(routeJson.name || '?'),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (upsertedRouteIds.length > 0) {
      const deleted = await this.db
        .delete(pricingRule)
        .where(inArray(pricingRule.routeId, upsertedRouteIds))
        .returning({ id: pricingRule.id });
      rulesDeleted = deleted.length;
    }

    const externalRouteCodes: string[] = [];
    for (const pr of perRouteResults) {
      for (const r of pr.rules) {
        const raw = r.routeId ?? r.route_id;
        if (typeof raw === 'string' && UUID_RE.test(raw)) continue;
        const code = r.routeCode ?? r.route_code;
        if (typeof code === 'string' && code.trim() && !routeIdByCode.has(code.trim())) {
          externalRouteCodes.push(code.trim());
        }
      }
    }
    const uniqueExternalCodes = Array.from(new Set(externalRouteCodes));
    if (uniqueExternalCodes.length > 0) {
      const external = await this.db
        .select({ id: logisticsRoute.id, routeCode: logisticsRoute.routeCode })
        .from(logisticsRoute)
        .where(inArray(logisticsRoute.routeCode, uniqueExternalCodes));
      for (const r of external) {
        if (r.routeCode) routeIdByCode.set(r.routeCode, r.id);
      }
      this.logger.log(`batchUpsertFromJson [${provider}]: resolved ${external.length}/${uniqueExternalCodes.length} external routeCodes`);
    }

    for (const pr of perRouteResults) {
      if (pr.rules.length === 0) continue;
      type PricingRuleInsertValue = typeof pricingRule.$inferInsert;
      const values: PricingRuleInsertValue[] = [];
      for (const r of pr.rules) {
        let resolvedRouteId: string | null = null;
        const raw = r.routeId ?? r.route_id;
        if (typeof raw === 'string' && UUID_RE.test(raw)) {
          resolvedRouteId = raw;
        } else {
          const code = r.routeCode ?? r.route_code;
          if (typeof code === 'string' && code.trim() && routeIdByCode.has(code.trim())) {
            resolvedRouteId = routeIdByCode.get(code.trim())!;
          } else {
            resolvedRouteId = pr.routeId;
          }
        }
        if (!resolvedRouteId) {
          errors.push({ name: pr.name, error: `pricing rule routeId cannot be resolved: ${JSON.stringify(r.routeId ?? r.routeCode)}` });
          continue;
        }
        values.push({
          routeId: resolvedRouteId,
          minWeight: r.minWeight != null ? String(r.minWeight) : null,
          maxWeight: r.maxWeight != null ? String(r.maxWeight) : null,
          unitPrice: r.unitPrice != null ? String(r.unitPrice) : null,
          firstWeightPrice: r.firstWeightPrice != null ? String(r.firstWeightPrice) : null,
          continuedWeightPrice: r.continuedWeightPrice != null ? String(r.continuedWeightPrice) : null,
          minCharge: r.minCharge != null ? String(r.minCharge) : null,
          remark: r.remark ? String(r.remark).slice(0, 2000) : null,
          countries: r.countries ? String(r.countries).slice(0, 2000) : null,
          ruleType: r.ruleType ? String(r.ruleType) : null,
          routeName: r.routeName ? String(r.routeName) : null,
          applicableRegions: r.applicableRegions ? String(r.applicableRegions) : null,
          zipCodeRanges: r.zipCodeRanges ? String(r.zipCodeRanges) : null,
          minLength: r.minLength != null ? String(r.minLength) : null,
          maxLength: r.maxLength != null ? String(r.maxLength) : null,
          unitPriceUnit: r.unitPriceUnit ? String(r.unitPriceUnit) : 'kg',
          firstWeightUnit: r.firstWeightUnit ? String(r.firstWeightUnit) : 'kg',
          continuedWeightUnit: r.continuedWeightUnit ? String(r.continuedWeightUnit) : 'kg',
          overPerimeterSurcharge: r.overPerimeterSurcharge != null ? String(r.overPerimeterSurcharge) : null,
          remoteAreaSurcharge: r.remoteAreaSurcharge != null ? String(r.remoteAreaSurcharge) : null,
          overLengthSurcharge: r.overLengthSurcharge != null ? String(r.overLengthSurcharge) : null,
          overWeightSurcharge: r.overWeightSurcharge != null ? String(r.overWeightSurcharge) : null,
          overLengthCondition: r.overLengthCondition != null ? String(r.overLengthCondition) : null,
          overWeightCondition: r.overWeightCondition != null ? String(r.overWeightCondition) : null,
          woodenBoxPrice: r.woodenBoxPrice != null ? String(r.woodenBoxPrice) : null,
          woodenFramePrice: r.woodenFramePrice != null ? String(r.woodenFramePrice) : null,
          fuelSurcharge: r.fuelSurcharge != null ? String(r.fuelSurcharge) : null,
          registrationFee: r.registrationFee != null ? String(r.registrationFee) : null,
          customsClearanceFee: r.customsClearanceFee != null ? String(r.customsClearanceFee) : null,
          podFee: r.podFee != null ? String(r.podFee) : null,
          palletFee: r.palletFee ?? null,
          packageUnit: r.packageUnit != null ? String(r.packageUnit) : null,
          taxFee: r.taxFee != null ? String(r.taxFee) : null,
          routeCode: r.routeCode != null ? String(r.routeCode).trim() || null : null,
        });
      }
      if (values.length > 0) {
        await this.db.insert(pricingRule).values(values);
        rulesInserted += values.length;
      }
    }

    this.logger.log(
      `batchUpsertFromJson [${provider}]: created=${created} updated=${updated} rulesInserted=${rulesInserted} rulesDeleted=${rulesDeleted} errors=${errors.length}`,
    );
    return { provider, created, updated, rulesInserted, rulesDeleted, errors };
  }

  async getDimensionLimits(): Promise<{ items: { routeId: string; routeName: string; sumDimensionLimit: number | null; longestSideLimit: number | null; perimeterLimit: string | null; lengthLimit: number | null; widthLimit: number | null; heightLimit: number | null; taxFee: string | null }[] }> {
    type RawRow = {
      routeId: string;
      routeName: string;
      sumDimensionLimit: number | string | null;
      longestSideLimit: number | string | null;
      perimeterLimit: string | null;
      lengthLimit: number | string | null;
      widthLimit: number | string | null;
      heightLimit: number | string | null;
      taxFee: string | null;
    };

    const rows: RawRow[] = await this.db.execute<RawRow>(sql`
      SELECT
        lr.id AS "routeId",
        lr.name AS "routeName",
        lr.sum_dimension_limit AS "sumDimensionLimit",
        lr.longest_side_limit AS "longestSideLimit",
        lr.perimeter_limit AS "perimeterLimit",
        lr.length_limit AS "lengthLimit",
        lr.width_limit AS "widthLimit",
        lr.height_limit AS "heightLimit",
        (
          SELECT pr.tax_fee
          FROM pricing_rule pr
          WHERE (pr.route_code = lr.route_code OR pr.route_id = lr.id)
            AND pr.tax_fee IS NOT NULL
            AND pr.tax_fee <> ''
          ORDER BY pr._created_at ASC
          LIMIT 1
        ) AS "taxFee"
      FROM logistics_route lr
      WHERE lr.is_active = '启用'
      ORDER BY lr._created_at DESC
    `);

    const items = rows.map((r: RawRow) => ({
      routeId: r.routeId,
      routeName: r.routeName,
      sumDimensionLimit: r.sumDimensionLimit != null ? Number(r.sumDimensionLimit) : null,
      longestSideLimit: r.longestSideLimit != null ? Number(r.longestSideLimit) : null,
      perimeterLimit: r.perimeterLimit ?? null,
      lengthLimit: r.lengthLimit != null ? Number(r.lengthLimit) : null,
      widthLimit: r.widthLimit != null ? Number(r.widthLimit) : null,
      heightLimit: r.heightLimit != null ? Number(r.heightLimit) : null,
      taxFee: r.taxFee ?? null,
    }));

    return { items };
  }

}
