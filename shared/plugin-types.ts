// ---- plugin:logistics_route_quote_bitable_sync_1 ----
// ============================================================
// 插件 logistics_route_quote_bitable_sync_1 (物流线路报价数据同步飞书多维表格) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface LogisticsRouteQuoteBitableSyncOneBatchaddrecordsInput {
  /** [object Object] */
  records: {
    record: {
      '运输类型（境内派送or跨境运输）': string;
      '线路级别的附加说明或备注': string;
      '@description 覆盖国家/地区，逗号分隔': string;
      '@description 覆盖城市，逗号分隔': string;
      '@description 最小物流时长（天）': string;
      '@description 最大物流时长（天）': string;
      '渠道类型': string;
      '线路名称，格式：物流商+线路名称': string;
      '@description 支持邮编范围': string;
      '@description 支持物品类别，逗号分隔': string;
      '是否启用': string;
    };
  }[];
}

/**
 * capabilityClient.load('logistics_route_quote_bitable_sync_1').call<LogisticsRouteQuoteBitableSyncOneBatchaddrecordsOutput>('batchAddRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export interface LogisticsRouteQuoteBitableSyncOneBatchaddrecordsOutput {
  /** [object Object] */
  records: {
    id: string;
  }[];
}

export interface LogisticsRouteQuoteBitableSyncOneBatchupdaterecordsInput {
  /** [object Object] */
  records: {
    id: string;
    record: {
      '@description 覆盖国家/地区，逗号分隔': string;
      '@description 最大物流时长（天）': string;
      '是否启用': string;
      '渠道类型': string;
      '@description 最小物流时长（天）': string;
      '运输类型（境内派送or跨境运输）': string;
      '线路级别的附加说明或备注': string;
      '线路名称，格式：物流商+线路名称': string;
      '@description 覆盖城市，逗号分隔': string;
      '@description 支持邮编范围': string;
      '@description 支持物品类别，逗号分隔': string;
    };
  }[];
}

/**
 * capabilityClient.load('logistics_route_quote_bitable_sync_1').call<LogisticsRouteQuoteBitableSyncOneBatchupdaterecordsOutput>('batchUpdateRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records } = result;
 * 返回值形如：
 *   {"records":[{"id":"示例文本"}]}
 */
export interface LogisticsRouteQuoteBitableSyncOneBatchupdaterecordsOutput {
  /** [object Object] */
  records: {
    id: string;
  }[];
}

export interface LogisticsRouteQuoteBitableSyncOneSearchrecordsInput {
  /** [object Object] */
  sort?: {
    fieldName: string;
    desc: boolean;
  }[];
  /** [object Object] */
  filter?: {
    conjunction: string;
    conditions: {
      operator: string;
      value: string[];
      fieldName: string;
    }[];
  };
  /** [object Object] */
  pageToken?: string;
  /** [object Object] */
  pageSize?: number;
  /** [object Object] */
  fieldNames?: string[];
}

/**
 * capabilityClient.load('logistics_route_quote_bitable_sync_1').call<LogisticsRouteQuoteBitableSyncOneSearchrecordsOutput>('searchRecords', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { records, hasMore, pageToken, ... } = result;
 * 返回值形如：
 *   {"records":[{"record":{"@description 支持物品类别，逗号分隔":null,"是否启用":null,"线路级别的附加说明或备注":null,"@description 覆盖城市，逗号分隔":null,"@description 支持邮编范围":null,"@description 最小物流时长（天）":null,"@description 最大物流时长（天）":null,"渠道类型":null,"运输类型（境内派送or跨境运输）":null,"线路名称，格式：物流商+线路名称":{},"@description 覆盖国家/地区，逗号分隔":null},"id":"示例文本"}],"hasMore":false,"pageToken":"示例文本","total":0}
 */
export interface LogisticsRouteQuoteBitableSyncOneSearchrecordsOutput {
  /** [object Object] */
  records: {
    record: {
      '@description 支持物品类别，逗号分隔': unknown;
      '是否启用': unknown;
      '线路级别的附加说明或备注': unknown;
      '@description 覆盖城市，逗号分隔': unknown;
      '@description 支持邮编范围': unknown;
      '@description 最小物流时长（天）': unknown;
      '@description 最大物流时长（天）': unknown;
      '渠道类型': unknown;
      '运输类型（境内派送or跨境运输）': unknown;
      '线路名称，格式：物流商+线路名称': {
        text: string;
      };
      '@description 覆盖国家/地区，逗号分隔': unknown;
    };
    id: string;
  }[];
  /** [object Object] */
  hasMore: boolean;
  /** [object Object] */
  pageToken?: string;
  /** [object Object] */
  total?: number;
}
// ---- end:logistics_route_quote_bitable_sync_1 ----