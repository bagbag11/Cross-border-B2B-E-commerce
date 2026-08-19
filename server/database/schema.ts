/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { bigint, boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const logisticsRoute = pgTable("logistics_route", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  providerName: varchar("provider_name", { length: 255 }),
  // Synced field: auto-synced, do not modify or delete
  name: varchar("name", { length: 255 }).notNull(),
  // Synced field: auto-synced, do not modify or delete
  coverCountries: varchar("cover_countries", { length: 2000 }).notNull(),
  // Synced field: auto-synced, do not modify or delete
  coverCities: varchar("cover_cities", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  postalCodeRange: varchar("postal_code_range", { length: 500 }),
  // Synced field: auto-synced, do not modify or delete
  supportedCategories: varchar("supported_categories", { length: 500 }),
  // Synced field: auto-synced, do not modify or delete
  minDeliveryDays: integer("min_delivery_days"),
  // Synced field: auto-synced, do not modify or delete
  maxDeliveryDays: integer("max_delivery_days"),
  // Synced field: auto-synced, do not modify or delete
  isActive: varchar("is_active", { length: 20 }).notNull().default('启用'),
  // Synced field: auto-synced, do not modify or delete
  packagingRestriction: varchar("packaging_restriction", { length: 500 }),
  // Synced field: auto-synced, do not modify or delete
  remark: varchar("remark", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  channelType: varchar("channel_type", { length: 20 }),
  // Synced field: auto-synced, do not modify or delete
  transportType: varchar("transport_type", { length: 50 }).default('cross_border'),
  // Synced field: auto-synced, do not modify or delete
  sumDimensionLimit: bigint("sum_dimension_limit", { mode: 'number' }),
  // Synced field: auto-synced, do not modify or delete
  longestSideLimit: bigint("longest_side_limit", { mode: 'number' }),
  // Synced field: auto-synced, do not modify or delete
  serviceType: varchar("service_type", { length: 30 }).default('unknown'),
  // Synced field: auto-synced, do not modify or delete
  effectiveDate: date("effective_date"),
  // Synced field: auto-synced, do not modify or delete
  currency: varchar("currency", { length: 10 }).default('CNY'),
  // Synced field: auto-synced, do not modify or delete
  billingMode: varchar("billing_mode", { length: 30 }).notNull().default('volumetric_weight'),
  // Synced field: auto-synced, do not modify or delete
  lastMileDoor: boolean("last_mile_door").default(true),
  // Synced field: auto-synced, do not modify or delete
  perimeterLimit: varchar("perimeter_limit", { length: 200 }),
  // Synced field: auto-synced, do not modify or delete
  lengthLimit: bigint("length_limit", { mode: 'number' }),
  // Synced field: auto-synced, do not modify or delete
  widthLimit: bigint("width_limit", { mode: 'number' }),
  // Synced field: auto-synced, do not modify or delete
  heightLimit: bigint("height_limit", { mode: 'number' }),
  // Synced field: auto-synced, do not modify or delete
  routeCode: varchar("route_code", { length: 100 }).unique(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId3: varchar("base_record_id_3").unique(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1872514549734426").on(table.baseRecordId3),
  uniqueIndex("unq_logistics_route_route_code_notnull").on(table.routeCode),
  index("idx_logistics_route_is_active").on(table.isActive),
  index("idx_logistics_route_cover_countries_trgm").using("gin", table.coverCountries),
  index("idx_logistics_route_name").on(table.name),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const forwarderSupplierPayment = pgTable("forwarder_supplier_payment", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  type: text("type"),
  // Synced field: auto-synced, do not modify or delete
  name: text("name"),
  // Synced field: auto-synced, do not modify or delete
  paymentTerm: text("payment_term"),
  // Synced field: auto-synced, do not modify or delete
  invoiceDate: text("invoice_date"),
  // Synced field: auto-synced, do not modify or delete
  paymentDate: text("payment_date"),
  // Synced field: auto-synced, do not modify or delete
  invoiceStatus: text("invoice_status"),
  // Synced field: auto-synced, do not modify or delete
  freightInvoiceTaxRate: numeric("freight_invoice_tax_rate"),
  // Synced field: auto-synced, do not modify or delete
  invoiceTaxRate: text("invoice_tax_rate"),
  // Synced field: auto-synced, do not modify or delete
  invoicePaymentCompany: text("invoice_payment_company"),
  // Synced field: auto-synced, do not modify or delete
  paymentMethod: text("payment_method"),
  // Synced field: auto-synced, do not modify or delete
  paymentCode: text("payment_code").array(),
  // Synced field: auto-synced, do not modify or delete
  counterpartyName: text("counterparty_name"),
  // Synced field: auto-synced, do not modify or delete
  counterpartyAccount: text("counterparty_account"),
  // Synced field: auto-synced, do not modify or delete
  counterpartyBank: text("counterparty_bank"),
  // Synced field: auto-synced, do not modify or delete
  department: text("department"),
  /**
   * 查找是否录入
   */
  // Synced field: auto-synced, do not modify or delete
  checkIfEntered: jsonb("check_if_entered"),
  // Synced field: auto-synced, do not modify or delete
  aiCheck: text("ai_check"),
  // Synced field: auto-synced, do not modify or delete
  aiCheckSupplier: text("ai_check_supplier"),
  /**
   * 查找是否录入-供应商
   */
  // Synced field: auto-synced, do not modify or delete
  checkSupplierEntered: jsonb("check_supplier_entered"),
  // Synced field: auto-synced, do not modify or delete
  field1: text("field_1"),
  // Synced field: auto-synced, do not modify or delete
  field2: text("field_2"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1871239596010696").on(table.id),
  uniqueIndex("unq_1871239596010728").on(table.baseRecordId),
]);

export const userInputHistory = pgTable("user_input_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  fieldName: varchar("field_name", { length: 50 }).notNull(),
  fieldValue: varchar("field_value", { length: 500 }).notNull(),
  inputCount: integer("input_count").default(1),
  lastUsedAt: customTimestamptz("last_used_at", { precision: 6 }).default(sql`now()`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).default(sql`now()`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).default(sql`now()`),
}, (table) => [
  index("idx_user_input_history_user_field").on(table.userId, table.fieldName),
  index("idx_user_input_history_last_used").on(table.userId, table.fieldName, table.lastUsedAt),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const freightForwarderCoopCount = pgTable("freight_forwarder_coop_count", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  inputDate: date("input_date"),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderShortname: text("freight_forwarder_shortname"),
  // Synced field: auto-synced, do not modify or delete
  invoiceStatus: text("invoice_status").array(),
  // Synced field: auto-synced, do not modify or delete
  suggestedCooperationCancelReason: text("suggested_cooperation_cancel_reason").array(),
  /**
   * 最近7天合作次数
   */
  // Synced field: auto-synced, do not modify or delete
  cooperationTimesLast7Days: jsonb("cooperation_times_last_7_days"),
  // Synced field: auto-synced, do not modify or delete
  last7Days: customTimestamptz("last_7_days", { precision: 6 }),
  // Synced field: auto-synced, do not modify or delete
  cooperationTimes: bigint("cooperation_times", { mode: 'number' }),
  /**
   * 最近一次合作日期
   */
  // Synced field: auto-synced, do not modify or delete
  lastCooperationDate: jsonb("last_cooperation_date"),
  // Synced field: auto-synced, do not modify or delete
  cooperatedCountries: text("cooperated_countries").array(),
  // Synced field: auto-synced, do not modify or delete
  actualFreightAmount: numeric("actual_freight_amount"),
  // Synced field: auto-synced, do not modify or delete
  quotedAmount: numeric("quoted_amount"),
  // Synced field: auto-synced, do not modify or delete
  markupIndex: numeric("markup_index"),
  // Synced field: auto-synced, do not modify or delete
  establishmentTime: date("establishment_time"),
  // Synced field: auto-synced, do not modify or delete
  qualificationCheck: text("qualification_check"),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderContact: userProfileArray("freight_forwarder_contact"),
  // Synced field: auto-synced, do not modify or delete
  checker: userProfileArray("checker"),
  // Synced field: auto-synced, do not modify or delete
  qualificationCheckNote: text("qualification_check_note"),
  // Synced field: auto-synced, do not modify or delete
  onlineDeliveryIncentive: numeric("online_delivery_incentive"),
  // Synced field: auto-synced, do not modify or delete
  appSourceId: text("app_source_id"),
  /**
   * 货代群
   */
  // Synced field: auto-synced, do not modify or delete
  freightForwarderGroup: jsonb("freight_forwarder_group"),
  // Synced field: auto-synced, do not modify or delete
  cooperationStatus: text("cooperation_status"),
  // Synced field: auto-synced, do not modify or delete
  cooperationEndDate: date("cooperation_end_date"),
  // Synced field: auto-synced, do not modify or delete
  actualFreight2025: numeric("actual_freight_2025"),
  // Synced field: auto-synced, do not modify or delete
  disputeRate2025: numeric("dispute_rate_2025"),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderDisputeReason: text("freight_forwarder_dispute_reason").array(),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderDisputeAmount: numeric("freight_forwarder_dispute_amount"),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderDispute2024: numeric("freight_forwarder_dispute_2024"),
  // Synced field: auto-synced, do not modify or delete
  freightForwarderDispute2025: numeric("freight_forwarder_dispute_2025"),
  // Synced field: auto-synced, do not modify or delete
  actualFreight2024: numeric("actual_freight_2024"),
  // Synced field: auto-synced, do not modify or delete
  totalDisputeRate: numeric("total_dispute_rate"),
  // Synced field: auto-synced, do not modify or delete
  rate2024Dispute: numeric("rate_2024_dispute"),
  // Synced field: auto-synced, do not modify or delete
  quotation: text("quotation").array(),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1870238506654740").on(table.id),
  uniqueIndex("unq_1870238506654772").on(table.baseRecordId),
]);

export const agentCountryCoopCountStat = pgTable("agent_country_coop_count_stat", {
  id: uuid("id").primaryKey().unique().defaultRandom(),
  baseRecordId: varchar("base_record_id").unique(),
  countryFreightForwarderCombination: text("country_freight_forwarder_combination"),
  appFreightForwarderName: text("app_freight_forwarder_name"),
  country: text("country"),
  /**
   * 合作状态
   */
  cooperationStatus: jsonb("cooperation_status"),
  /**
   * 合作次数
   */
  cooperationCount: jsonb("cooperation_count"),
  markDuplicate: text("mark_duplicate"),
  lastUpdateTime: date("last_update_time"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by"),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 6 }).notNull().default(sql`now()`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by"),
}, (table) => [
  uniqueIndex("unq_1870237070682233").on(table.id),
  uniqueIndex("unq_1870237070683225").on(table.baseRecordId),
]);

// Synced table: data is auto-synced from external source. Do not rename or delete this table.
export const pricingRule = pgTable("pricing_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id"),
  // Synced field: auto-synced, do not modify or delete
  minWeight: numeric("min_weight"),
  // Synced field: auto-synced, do not modify or delete
  maxWeight: numeric("max_weight"),
  // Synced field: auto-synced, do not modify or delete
  unitPrice: numeric("unit_price"),
  // Synced field: auto-synced, do not modify or delete
  firstWeightPrice: numeric("first_weight_price"),
  // Synced field: auto-synced, do not modify or delete
  continuedWeightPrice: numeric("continued_weight_price"),
  // Synced field: auto-synced, do not modify or delete
  minCharge: varchar("min_charge", { length: 100 }),
  // Synced field: auto-synced, do not modify or delete
  remark: varchar("remark", { length: 2000 }),
  // Synced field: auto-synced, do not modify or delete
  countries: varchar("countries", { length: 2000 }),
  // Synced field: auto-synced, do not modify or delete
  ruleType: varchar("rule_type", { length: 50 }).default('standard'),
  // Synced field: auto-synced, do not modify or delete
  woodenBoxPrice: numeric("wooden_box_price"),
  // Synced field: auto-synced, do not modify or delete
  woodenFramePrice: numeric("wooden_frame_price"),
  // Synced field: auto-synced, do not modify or delete
  fuelSurcharge: varchar("fuel_surcharge", { length: 500 }),
  // Synced field: auto-synced, do not modify or delete
  registrationFee: varchar("registration_fee", { length: 100 }),
  // Synced field: auto-synced, do not modify or delete
  customsClearanceFee: varchar("customs_clearance_fee", { length: 100 }),
  /**
   * @type { zones: Array<{ name: string; price: number }> }
   */
  palletFee: jsonb("pallet_fee"),
  // Synced field: auto-synced, do not modify or delete
  routeName: varchar("route_name", { length: 255 }),
  // Synced field: auto-synced, do not modify or delete
  applicableRegions: text("applicable_regions"),
  // Synced field: auto-synced, do not modify or delete
  zipCodeRanges: text("zip_code_ranges"),
  // Synced field: auto-synced, do not modify or delete
  minLength: varchar("min_length", { length: 50 }),
  // Synced field: auto-synced, do not modify or delete
  unitPriceUnit: varchar("unit_price_unit", { length: 50 }),
  // Synced field: auto-synced, do not modify or delete
  firstWeightUnit: varchar("first_weight_unit", { length: 50 }),
  // Synced field: auto-synced, do not modify or delete
  continuedWeightUnit: varchar("continued_weight_unit", { length: 50 }),
  // Synced field: auto-synced, do not modify or delete
  remoteAreaSurcharge: varchar("remote_area_surcharge", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  overLengthSurcharge: varchar("over_length_surcharge", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  overWeightSurcharge: varchar("over_weight_surcharge", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  overPerimeterSurcharge: varchar("over_perimeter_surcharge", { length: 1000 }),
  // Synced field: auto-synced, do not modify or delete
  maxLength: numeric("max_length"),
  // Synced field: auto-synced, do not modify or delete
  packageUnit: varchar("package_unit", { length: 50 }),
  // Synced field: auto-synced, do not modify or delete
  taxFee: varchar("tax_fee", { length: 500 }),
  // Synced field: auto-synced, do not modify or delete
  podFee: varchar("pod_fee", { length: 100 }),
  // Synced field: auto-synced, do not modify or delete
  baseRecordId: varchar("base_record_id").unique(),
  // Synced field: auto-synced, do not modify or delete
  routeCode: varchar("route_code", { length: 100 }),
  // Synced field: auto-synced, do not modify or delete
  overLengthCondition: varchar("over_length_condition", { length: 100 }),
  // Synced field: auto-synced, do not modify or delete
  overWeightCondition: varchar("over_weight_condition", { length: 100 }),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  index("idx_pricing_rule_route_id").on(table.routeId),
  index("idx_pricing_rule_countries").on(table.countries),
  uniqueIndex("unq_1872510913684587").on(table.baseRecordId),
  index("idx_pricing_rule_route_code").on(table.routeCode),
  foreignKey({
    columns: [table.routeId],
    foreignColumns: [logisticsRoute.id],
    name: "pricing_rule_route_id_fkey",
  }).onDelete("cascade"),
]);

// table aliases
export const agentCountryCoopCountStatTable = agentCountryCoopCountStat;
export const forwarderSupplierPaymentTable = forwarderSupplierPayment;
export const freightForwarderCoopCountTable = freightForwarderCoopCount;
export const logisticsRouteTable = logisticsRoute;
export const pricingRuleTable = pricingRule;
export const userInputHistoryTable = userInputHistory;
