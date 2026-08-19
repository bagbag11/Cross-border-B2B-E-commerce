export interface PalletFeeZone {
  name: string;
  price: number;
}

export interface PalletFee {
  zones: PalletFeeZone[];
}

export interface LogisticsRouteListItem {
  id: string;
  name: string;
  coverCountries: string;
  coverCities: string;
  isActive: string;
  providerName: string | null;
  pricingRuleCount: number;
  updatedAt: string;
  updatedBy: string;
}

export interface LogisticsRouteListResponse {
  items: LogisticsRouteListItem[];
  total: number;
}

export interface LogisticsRouteListParams {
  country?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}

export interface PricingRuleItem {
  id: string;
  routeId: string | null;
  minWeight: number | null;
  maxWeight: number | null;
  unitPrice: number | null;
  firstWeightPrice: number | null;
  continuedWeightPrice: number | null;
  minCharge: string | null;
  remark: string | null;
  countries: string | null;
  ruleType: string | null;
  routeName: string | null;
  applicableRegions: string | null;
  zipCodeRanges: string | null;
  minLength: string | null;
  maxLength: number | null;
  unitPriceUnit: string | null;
  firstWeightUnit: string | null;
  continuedWeightUnit: string | null;
  packageUnit: string | null;
  woodenBoxPrice: number | null;
  woodenFramePrice: number | null;
  fuelSurcharge: string | null;
  overLengthSurcharge: string | null;
  overWeightSurcharge: string | null;
  overPerimeterSurcharge: string | null;
  overLengthCondition: string | null;
  overWeightCondition: string | null;
  remoteAreaSurcharge: string | null;
  taxFee: string | null;
  registrationFee: string | null;
  customsClearanceFee: string | null;
  podFee: string | null;
  palletFee: PalletFee | null;
  routeCode: string | null;
}

export interface LogisticsRouteDetail {
  id: string;
  name: string;
  coverCountries: string;
  coverCities: string;
  postalCodeRange: string;
  supportedCategories: string;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  isActive: string;
  providerName: string | null;
  billingMode: 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume';
  lastMileDoor: boolean;
  perimeterLimit: string | null;
  lengthLimit: number | null;
  widthLimit: number | null;
  heightLimit: number | null;
  effectiveDate: string | null;
  currency: string | null;
  routeCode: string | null;
  pricingRules: PricingRuleItem[];
}

export interface CreateLogisticsRouteRequest {
  name: string;
  coverCountries: string;
  coverCities: string;
  postalCodeRange: string;
  supportedCategories: string;
  providerName?: string;
  billingMode?: 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume';


  lastMileDoor?: boolean;
  perimeterLimit?: string;
  lengthLimit?: number;
  widthLimit?: number;
  heightLimit?: number;
  effectiveDate?: string;
  currency?: string;
  routeCode?: string | null;
}

export interface UpdateLogisticsRouteRequest {
  name: string;
  coverCountries: string;
  coverCities: string;
  postalCodeRange: string;
  supportedCategories: string;
  providerName?: string;
  billingMode?: 'actual_weight' | 'volumetric_weight' | 'max_both' | 'volume';


  lastMileDoor?: boolean;
  perimeterLimit?: string;
  lengthLimit?: number;
  widthLimit?: number;
  heightLimit?: number;
  effectiveDate?: string;
  currency?: string;
  routeCode?: string | null;
}

export interface ToggleRouteStatusRequest {
  isActive: string;
}

export interface CreatePricingRuleRequest {
  minWeight?: number | null;
  maxWeight?: number | null;
  unitPrice?: number;
  firstWeightPrice?: number;
  continuedWeightPrice?: number;
  minCharge?: string;
  remark?: string;
  countries?: string;
  ruleType?: string;
  routeName?: string;
  applicableRegions?: string;
  zipCodeRanges?: string;
  minLength?: string;
  maxLength?: number;
  unitPriceUnit?: string;
  firstWeightUnit?: string;
  continuedWeightUnit?: string;
  packageUnit?: string;
  woodenBoxPrice?: number;
  woodenFramePrice?: number;
  fuelSurcharge?: string;
  overLengthSurcharge?: string;
  overWeightSurcharge?: string;
  overPerimeterSurcharge?: string;
  overLengthCondition?: string;
  overWeightCondition?: string;
  remoteAreaSurcharge?: string;
  taxFee?: string;
  registrationFee?: string;
  customsClearanceFee?: string;
  podFee?: string;
  palletFee?: PalletFee;
  routeCode?: string | null;
}

export interface UpdatePricingRuleRequest {
  minWeight?: number | null;
  maxWeight?: number | null;
  unitPrice?: number;
  firstWeightPrice?: number;
  continuedWeightPrice?: number;
  minCharge?: string;
  remark?: string;
  countries?: string;
  ruleType?: string;
  routeName?: string;
  applicableRegions?: string;
  zipCodeRanges?: string;
  minLength?: string;
  maxLength?: number;
  unitPriceUnit?: string;
  firstWeightUnit?: string;
  continuedWeightUnit?: string;
  packageUnit?: string;
  woodenBoxPrice?: number;
  woodenFramePrice?: number;
  fuelSurcharge?: string;
  overLengthSurcharge?: string;
  overWeightSurcharge?: string;
  overPerimeterSurcharge?: string;
  overLengthCondition?: string;
  overWeightCondition?: string;
  remoteAreaSurcharge?: string;
  taxFee?: string;
  registrationFee?: string;
  customsClearanceFee?: string;
  podFee?: string;
  palletFee?: PalletFee;
  routeCode?: string | null;
}

export interface DimensionGroup {
  length: number;
  width: number;
  height: number;
  quantity: number;
}

export interface RouteDimensionLimit {
  routeId: string;
  routeName: string;
  sumDimensionLimit: number | null;
  longestSideLimit: number | null;
  perimeterLimit: string | null;
  lengthLimit: number | null;
  widthLimit: number | null;
  heightLimit: number | null;
  taxFee: string | null;
}

export interface RouteDimensionLimitsResponse {
  items: RouteDimensionLimit[];
}

export interface InquiryRequest {
  country: string;
  city: string;
  postalCode: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  quantity: number;
  packagesCount: number;
  category: string;
  packagingType: string;
  declaredValue: number;
  expectedDays: number;
  itemName?: string;
  customsType?: string;
  dimensionGroups?: DimensionGroup[];
  maxResults?: number;
}

export interface VolumetricCalculation {
  length: number;
  width: number;
  height: number;
  quantity: number;
  divisor: number;
  volumetricWeight: number;
  actualWeight: number;
  usedVolumetric: boolean;
  groups?: DimensionGroup[];
  adjustedGroups?: DimensionGroup[];
  hasWoodenAdjust?: boolean;
}

export interface SurchargeItem {
  label: string;
  amount: number;
  description?: string;
}

export interface InquiryPriceDetail {
  billingMode: string;
  unitPrice: number | null;
  firstWeightPrice: number | null;
  continuedWeightPrice: number | null;
  minCharge: number;
  weightCharge: number;
  actualWeight?: number;
  volumetricWeight?: number;
  usedVolumetricWeight?: boolean;
  billingModeLabel?: string;
  volumeWeightDivisor?: number | null;
  volumetricCalculation?: {
    length: number;
    width: number;
    height: number;
    quantity: number;
    divisor: number;
    volumetricWeight: number;
    actualWeight: number;
    usedVolumetric: boolean;
    groups?: DimensionGroup[];
    adjustedGroups?: DimensionGroup[];
    hasWoodenAdjust?: boolean;
  };
  oversizeSurcharge?: number;
  overweightSurcharge?: number;
  remoteAreaSurcharge?: number;
  fuelSurcharge?: number;
  packagingFee?: number;
  packagingType?: string;
  packagingUnit?: string;
  freightCharge?: number;
  surchargeTotal?: number;
  surchargeItems?: SurchargeItem[];
  billingFormula?: string[];
}

export type ChannelType = 'air' | 'sea' | 'land' | 'warehouse';

export type TransportType =
  | 'trunk_lastmile'
  | 'international_trunk_only'
  | 'overseas_lastmile_only'
  | 'combined';

export interface CombinedRouteInfo {
  routeId: string;
  routeName: string;
  totalPrice: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  transportType: 'international_trunk_only' | 'overseas_lastmile_only';
  priceDetail: InquiryPriceDetail;
  billingFormula?: string[];
}

export interface InquiryResultItem {
  routeId: string;
  routeName: string;
  providerName: string | null;
  channelType: ChannelType | null;
  transportType: TransportType;
  totalPrice: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  score: number;
  tag: string;
  remark: string;
  priceNote: string;
  paymentDays: number;
  paymentTerm?: string;
  cooperationCount: number | null;
  serviceType: string;
  serviceTypeLabel: string;
  lastMileDoor: boolean | null;
  lastMileDoorLabel: string;
  priceDetail: InquiryPriceDetail;
  billingFormula?: string[];
  combinedFrom?: {
    trunk: CombinedRouteInfo;
    lastmile: CombinedRouteInfo;
  };
}

export interface InquiryResponse {
  items: InquiryResultItem[];
}

export interface SuccessResponse {
  success: boolean;
}

export interface CreateRouteResponse {
  id: string;
}

export interface CreatePricingRuleResponse {
  id: string;
}

export interface UserInputHistoryItem {
  fieldValue: string;
  inputCount: number;
  lastUsedAt: string;
}

export interface UserInputHistoryResponse {
  items: UserInputHistoryItem[];
}

export interface SaveUserInputHistoryRequest {
  records: {
    fieldName: string;
    fieldValue: string;
  }[];
}

export interface UserInputHistoryRecord {
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
}

export interface UserInputHistoryListResponse {
  items: UserInputHistoryRecord[];
  total: number;
}

