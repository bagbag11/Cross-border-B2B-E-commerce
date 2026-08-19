import { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, Handshake, Info, Plane, Ship, Truck, Globe, ArrowUpDown, ArrowUp, ArrowDown, Route, AlertTriangle } from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@client/src/components/ui/empty';
import type { InquiryResultItem, ChannelType } from '@shared/api.interface';

interface InquiryResultsProps {
  items: InquiryResultItem[];
  loading: boolean;
  hasSearched: boolean;
  selectedRoutes?: string[];
  onToggleSelect?: (routeId: string, routeName: string) => void;
}

const RESULTS_CONTAINER_VARIANTS = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const RESULT_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'tween', duration: 0.2, ease: 'easeOut' },
  },
};

const Warehouse = Truck;

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof Plane; color: string }> = {
  air: { label: '空运', icon: Plane, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  sea: { label: '海运', icon: Ship, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  land: { label: '陆运', icon: Truck, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  warehouse: { label: '仓储', icon: Warehouse, color: 'text-violet-700 bg-violet-50 border-violet-200' },
};

const TRANSPORT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  combined: { label: '组合路线（国际干线 + 海外尾程派送）', icon: Route, color: 'text-emerald-700' },
  trunk_lastmile: { label: '干线 + 尾程派送', icon: Globe, color: 'text-blue-700' },
};

type SortKey = 'score' | 'price_asc' | 'price_desc' | 'days_asc' | 'days_desc';

const InquiryResults = ({ items, loading, hasSearched, selectedRoutes = [], onToggleSelect }: InquiryResultsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const toggleExpand = (routeId: string): void => {
    setExpandedId((prev) => (prev === routeId ? null : routeId));
  };

  const getTagBadgeClass = (tag: string): string => {
    if (tag === '组合推荐') return 'border-emerald-600 text-emerald-600 bg-transparent';
    if (tag === '综合推荐') return 'border-[#F9AB00] text-[#F9AB00] bg-transparent';
    if (tag === '时效最优' || tag === '性价比首选') return 'border-primary text-primary bg-transparent';
    if (tag === '经济之选') return 'border-[hsl(145_63%_42%)] text-[hsl(145_63%_42%)] bg-transparent';
    if (tag === '时效优良') return 'border-[hsl(213_50%_65%)] text-[hsl(213_50%_65%)] bg-transparent';
    return 'border-border text-muted-foreground bg-transparent';
  };

  const getServiceTypeBadgeClass = (serviceType: string): string => {
    if (
      serviceType === 'double_clearance_tax_door' ||
      serviceType === 'double_clearance_tax' ||
      serviceType === 'ddp' ||
      serviceType === 'reverse_calc'
    ) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (
      serviceType === 'deferred' ||
      serviceType === 'pva' ||
      serviceType === 'ddu' ||
      serviceType === 'dap' ||
      serviceType === 'acp'
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (serviceType === 'unknown') {
      return 'bg-gray-100 text-gray-600 border-gray-200';
    }
    return 'bg-red-500 text-white border-red-500 font-semibold';
  };

  const isDoubleClearance = (serviceType: string): boolean => {
    return (
      serviceType === 'double_clearance_tax_door' ||
      serviceType === 'double_clearance_tax' ||
      serviceType === 'ddp' ||
      serviceType === 'reverse_calc'
    );
  };

  const availableProviders = useMemo(
    () => [...new Set(items.map((i: InquiryResultItem) => i.providerName).filter(Boolean))].sort(),
    [items],
  );

  useEffect(() => { setProviderFilter('all'); }, [items]);

  const sortedItems = useMemo(() => {
    const filtered = providerFilter === 'all'
      ? items
      : items.filter((i: InquiryResultItem) => i.providerName === providerFilter);
    const sorted = [...filtered];
    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => a.totalPrice - b.totalPrice);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.totalPrice - a.totalPrice);
        break;
      case 'days_asc':
        sorted.sort((a, b) => {
          const aDays = a.maxDeliveryDays || a.minDeliveryDays || Infinity;
          const bDays = b.maxDeliveryDays || b.minDeliveryDays || Infinity;
          return aDays - bDays;
        });
        break;
      case 'days_desc':
        sorted.sort((a, b) => {
          const aDays = a.maxDeliveryDays || a.minDeliveryDays || 0;
          const bDays = b.maxDeliveryDays || b.minDeliveryDays || 0;
          return bDays - aDays;
        });
        break;
      case 'score':
      default:
        sorted.sort((a, b) => b.score - a.score);
        break;
    }
    return sorted;
  }, [items, sortBy, providerFilter]);

  const groupedItems = useMemo(() => {
    const combined: InquiryResultItem[] = [];
    const trunkLastmile: InquiryResultItem[] = [];
    for (const item of sortedItems) {
      if (item.transportType === 'combined') {
        combined.push(item);
      } else if (item.transportType === 'trunk_lastmile') {
        trunkLastmile.push(item);
      }
    }
    const groups: { type: string; items: InquiryResultItem[] }[] = [];
    if (combined.length > 0) groups.push({ type: 'combined', items: combined });
    if (trunkLastmile.length > 0) groups.push({ type: 'trunk_lastmile', items: trunkLastmile });
    return groups;
  }, [sortedItems]);

  const cycleSort = (key: SortKey, reverseKey: SortKey): void => {
    setSortBy((prev) => (prev === key ? reverseKey : prev === reverseKey ? key : key));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((i: number) => (
          <div key={i} className="bg-card rounded-sm shadow-sm border border-border p-5">
            <div className="flex items-start justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-8 w-28 mb-3" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="bg-card rounded-sm shadow-sm border border-border p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">
          填写左侧货物信息，点击「立即询价」查看匹配结果
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-sm shadow-sm border border-border p-8 min-h-[400px]">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂无匹配线路</EmptyTitle>
            <EmptyDescription>试试放宽目的地或调整重量范围</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          共 <span className="font-semibold text-foreground tabular-nums">{sortedItems.length}</span> 条线路{providerFilter !== 'all' && ` / ${items.length}`}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">排序</span>
          <Button
            variant={sortBy === 'score' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSortBy('score')}
          >
            <ArrowUpDown className="w-3 h-3 mr-1" />
            综合
          </Button>
          <Button
            variant={sortBy === 'price_asc' || sortBy === 'price_desc' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => cycleSort('price_asc', 'price_desc')}
          >
            {sortBy === 'price_desc' ? <ArrowDown className="w-3 h-3 mr-1" /> : <ArrowUp className="w-3 h-3 mr-1" />}
            价格
          </Button>
          <Button
            variant={sortBy === 'days_asc' || sortBy === 'days_desc' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => cycleSort('days_asc', 'days_desc')}
          >
            {sortBy === 'days_desc' ? <ArrowDown className="w-3 h-3 mr-1" /> : <ArrowUp className="w-3 h-3 mr-1" />}
            时效
          </Button>
          {availableProviders.length >= 2 && (
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[130px] h-7 text-xs ml-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部货代</SelectItem>
                {availableProviders.map((p: string) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {groupedItems.map((group) => {
        const config = TRANSPORT_TYPE_CONFIG[group.type];
        const GroupIcon = config?.icon || Globe;
        return (
          <div key={group.type} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <GroupIcon className={`w-4 h-4 ${config?.color || 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold text-foreground">{config?.label || group.type}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{group.items.length} 条</span>
            </div>
            <motion.div className="space-y-4" variants={RESULTS_CONTAINER_VARIANTS} initial="hidden" animate="visible">
              <AnimatePresence>
                {group.items.map((item: InquiryResultItem) => {
            const isExpanded: boolean = expandedId === item.routeId;
            const channel = item.channelType ? CHANNEL_CONFIG[item.channelType] : null;
            const ChannelIcon = channel?.icon;

            return (
              <motion.div
                key={item.routeId}
                variants={RESULT_CARD_VARIANTS}
                className="bg-card rounded-sm shadow-sm border border-border overflow-hidden"
              >
              <div className="p-5">
                 <div className="flex items-start justify-between mb-2">
                   <div className="flex items-start gap-2 flex-1 min-w-0">
                     {onToggleSelect && (
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           onToggleSelect(item.routeId, item.routeName);
                         }}
                         className={`mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${
                           selectedRoutes.includes(item.routeId)
                             ? 'bg-primary border-primary text-primary-foreground'
                             : 'border-border hover:border-primary'
                         }`}
                         aria-label={selectedRoutes.includes(item.routeId) ? '取消选择' : '选择路线'}
                       >
                         {selectedRoutes.includes(item.routeId) && (
                           <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                           </svg>
                         )}
                       </button>
                     )}
                     <div className="flex items-center gap-2 flex-wrap min-w-0">
                     <span className="text-sm font-semibold text-foreground">{item.routeName}</span>
                     {item.providerName && (
                       <Badge variant="outline" className="border-purple-300 text-purple-600 bg-purple-50 text-[10px]">
                         {item.providerName}
                       </Badge>
                     )}
                    {channel && ChannelIcon && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${channel.color}`}>
                        <ChannelIcon className="w-3 h-3" />
                        {channel.label}
                      </span>
                    )}
                    {item.priceDetail?.usedVolumetricWeight && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                        {item.priceDetail.billingModeLabel || '体积重计费'}
                      </Badge>
                    )}
                    {item.tag && (
                      <Badge variant="outline" className={getTagBadgeClass(item.tag)}>
                        {item.tag}
                      </Badge>
                    )}
                    {item.serviceTypeLabel && (
                      <Badge variant="outline" className={getServiceTypeBadgeClass(item.serviceType)}>
                        {item.serviceTypeLabel}
                      </Badge>
                    )}
                    {item.lastMileDoorLabel && (
                      <Badge
                        variant="outline"
                        className={item.lastMileDoor === true
                          ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                          : 'border-amber-500 text-amber-600 bg-amber-50'}
                      >
                        {item.lastMileDoorLabel}
                      </Badge>
                    )}
                      </div>
                   </div>
                   <span
                    className="text-2xl font-bold tabular-nums text-primary"
                    style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}
                  >
                    ¥{item.totalPrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {item.minDeliveryDays && item.maxDeliveryDays
                      ? `${item.minDeliveryDays}~${item.maxDeliveryDays} 天`
                      : '时效待定'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Handshake className="w-3.5 h-3.5" />
                    {item.cooperationCount != null && item.cooperationCount > 0 ? (
                      <>历史合作 <span className="font-semibold text-foreground tabular-nums">{item.cooperationCount}</span> 次</>
                    ) : (
                      <span className="text-muted-foreground">暂无合作数据</span>
                    )}
                  </span>
                </div>

                {!isDoubleClearance(item.serviceType) && item.serviceType !== 'unknown' && (
                  <div className="flex items-start gap-1.5 bg-red-50 rounded-sm px-3 py-2 mb-2 border border-red-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-red-700">
                        {item.serviceType === 'customer_clearance' && '客户自行清关 — 需自行处理海关清关手续，清关后需确认提货方式'}
                        {item.serviceType === 'customer_pickup' && '客户自行提货 — 货物到港后需自行安排提货'}
                        {item.serviceType === 'platform_warehouse' && '平台送仓 — 货物由平台安排送至指定仓库'}
                        {item.serviceType === 'standard' && '标准服务 — 请与货代确认清关及配送方式'}
                        {(item.serviceType === 'ddu' || item.serviceType === 'dap') && '自税清关 — 关税由收件人自行承担，请注意税费成本'}
                        {(item.serviceType === 'deferred' || item.serviceType === 'pva') && '递延清关 — 增值税递延缴纳，请确认账户资质'}
                        {item.serviceType === 'acp' && 'ACP逆算 — 日本关税按逆算法计算，请注意成本预估'}
                      </span>
                    </div>
                  </div>
                )}
                {item.serviceType === 'unknown' && (
                  <div className="flex items-start gap-1.5 bg-gray-50 rounded-sm px-3 py-2 mb-2 border border-gray-200">
                    <Info className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600">清关及配送方式未明确 — 建议提前与货代确认</span>
                  </div>
                )}

                {item.priceNote && (
                  <div className="flex items-start gap-1.5 bg-accent/50 rounded-sm px-3 py-2 mb-2">
                    <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.priceNote}</p>
                  </div>
                )}

                {item.remark && (
                  <p className="text-xs text-muted-foreground mb-2">{item.remark}</p>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpand(item.routeId)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  {isExpanded ? '收起详情' : '查看计费明细'}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      key={`detail-${item.routeId}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'tween', duration: 0.2 }}
                      className="overflow-hidden"
                    >
                       {item.combinedFrom ? (
                         <div className="pt-3 mt-3 border-t border-border text-xs space-y-3">
                           <div className="flex items-center gap-2 flex-wrap">
                             <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                               <Route className="w-3 h-3" />
                               组合路线
                             </span>
                             <span className="text-[11px] text-muted-foreground">
                               {item.combinedFrom.trunk.routeName} <span className="mx-1">+</span> {item.combinedFrom.lastmile.routeName}
                             </span>
                           </div>

                           {item.priceDetail.usedVolumetricWeight && item.priceDetail.volumetricCalculation && (
                             <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-sm p-3 border border-amber-200">
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-[11px] font-bold text-amber-800">记抛计费 (÷{item.priceDetail.volumetricCalculation.divisor})</span>
                                 {item.priceDetail.volumetricCalculation.hasWoodenAdjust && (
                                   <span className="text-[10px] font-medium text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded-sm">
                                     木箱膨胀
                                   </span>
                                 )}
                               </div>
                               <div className="space-y-1">
                                 <span className="font-semibold tabular-nums text-amber-700" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                   计费重量: {Math.max(item.priceDetail.volumetricCalculation.actualWeight, item.priceDetail.volumetricCalculation.volumetricWeight).toFixed(2)}kg
                                 </span>
                                 <span className="text-[11px] text-muted-foreground tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                   MAX(实重 {item.priceDetail.volumetricCalculation.actualWeight.toFixed(2)}kg, 体积重 {item.priceDetail.volumetricCalculation.volumetricWeight.toFixed(3)}kg)
                                 </span>
                                 {(item.priceDetail.volumetricCalculation.groups && item.priceDetail.volumetricCalculation.groups.length > 0
                                   ? item.priceDetail.volumetricCalculation.groups
                                   : [{ length: item.priceDetail.volumetricCalculation.length, width: item.priceDetail.volumetricCalculation.width, height: item.priceDetail.volumetricCalculation.height, quantity: item.priceDetail.volumetricCalculation.quantity }]
                                 ).map((g: { length: number; width: number; height: number; quantity: number }, i: number) => {
                                   const adj = item.priceDetail.volumetricCalculation?.adjustedGroups?.[i];
                                   const hasAdj = item.priceDetail.volumetricCalculation?.hasWoodenAdjust && adj;
                                   const groupVol = hasAdj
                                     ? adj.length * adj.width * adj.height * adj.quantity / item.priceDetail.volumetricCalculation!.divisor
                                     : g.length * g.width * g.height * g.quantity / item.priceDetail.volumetricCalculation!.divisor;
                                   return (
                                     <div key={i} className="space-y-0.5 mt-1.5 pt-1.5 border-t border-amber-200/60">
                                       {hasAdj && (
                                         <p className="text-[10px] text-muted-foreground tabular-nums line-through opacity-60" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                           原始: {g.length}×{g.width}×{g.height}cm × {g.quantity}件
                                         </p>
                                       )}
                                       <p className="text-[11px] text-amber-800 font-medium tabular-nums leading-relaxed" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                         {hasAdj ? `${adj.length}×${adj.width}×${adj.height}cm` : `${g.length}×${g.width}×${g.height}cm`} × {g.quantity}件 ÷ {item.priceDetail.volumetricCalculation!.divisor} = <span className="font-bold text-amber-900">{groupVol.toFixed(3)}kg</span>
                                       </p>
                                     </div>
                                   );
                                 })}
                                 {item.priceDetail.volumetricCalculation.hasWoodenAdjust && (
                                   <p className="text-[10px] text-rose-600 mt-1.5 pt-1 border-t border-amber-200/60">
                                     膨胀规则: 长+5cm、宽+5cm、高+15cm（含木箱/木架厚度）
                                   </p>
                                 )}
                               </div>
                             </div>
                           )}

                           <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-sm p-3 border border-blue-200">
                             <div className="flex items-center justify-between mb-2">
                               <span className="text-[11px] font-bold text-blue-800">运费计算</span>
                               <span className="text-lg font-bold tabular-nums text-blue-700" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                 ¥{(item.priceDetail.freightCharge ?? item.priceDetail.weightCharge).toFixed(2)}
                               </span>
                             </div>
                             <div className="space-y-1 text-[11px] text-blue-800 tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                               <div className="flex items-center justify-between">
                                 <span className="text-blue-600">国际干线 · {item.combinedFrom.trunk.priceDetail.billingMode}</span>
                                 <span>¥{item.combinedFrom.trunk.priceDetail.weightCharge.toFixed(2)}</span>
                               </div>
                               <div className="flex items-center justify-between">
                                 <span className="text-blue-600">海外尾程 · {item.combinedFrom.lastmile.priceDetail.billingMode}</span>
                                 <span>¥{item.combinedFrom.lastmile.priceDetail.weightCharge.toFixed(2)}</span>
                               </div>
                             </div>
                           </div>

                           {((item.priceDetail.surchargeTotal ?? 0) > 0 || item.combinedFrom.trunk.priceDetail.packagingFee || item.combinedFrom.lastmile.priceDetail.packagingFee) && (
                             <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-sm p-3 border border-amber-200">
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-[11px] font-bold text-amber-800">附加费计算</span>
                                 <span className="text-lg font-bold tabular-nums text-amber-700" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                   ¥{(item.priceDetail.surchargeTotal ?? 0).toFixed(2)}
                                 </span>
                               </div>
                                <div className="space-y-1.5">
                                  {item.combinedFrom.trunk.priceDetail.surchargeItems && item.combinedFrom.trunk.priceDetail.surchargeItems.length > 0 && item.combinedFrom.trunk.priceDetail.surchargeItems.map((s, idx) => (
                                    <div key={`trunk-${idx}`} className="flex items-center justify-between text-[11px] tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                      <span className="text-amber-700">国际干线 · {s.label}</span>
                                      <span className="text-amber-800 font-medium">+¥{s.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {item.combinedFrom.trunk.priceDetail.packagingFee != null && (
                                    <div className="flex items-center justify-between text-[11px] tabular-nums bg-rose-50/60 -mx-1 px-1 py-1 rounded-sm" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                      <span className="text-rose-700 font-semibold">国际干线 · 包装费 ({item.combinedFrom.trunk.priceDetail.packagingType ?? '-'})</span>
                                      <span className="text-rose-600 font-bold">+¥{(item.combinedFrom.trunk.priceDetail.packagingFee ?? 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {item.combinedFrom.lastmile.priceDetail.surchargeItems && item.combinedFrom.lastmile.priceDetail.surchargeItems.length > 0 && item.combinedFrom.lastmile.priceDetail.surchargeItems.map((s, idx) => (
                                    <div key={`lm-${idx}`} className="flex items-center justify-between text-[11px] tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                      <span className="text-amber-700">海外尾程 · {s.label}</span>
                                      <span className="text-amber-800 font-medium">+¥{s.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                  {item.combinedFrom.lastmile.priceDetail.packagingFee != null && (
                                    <div className="flex items-center justify-between text-[11px] tabular-nums bg-rose-50/60 -mx-1 px-1 py-1 rounded-sm" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                      <span className="text-rose-700 font-semibold">海外尾程 · 包装费 ({item.combinedFrom.lastmile.priceDetail.packagingType ?? '-'})</span>
                                      <span className="text-rose-600 font-bold">+¥{(item.combinedFrom.lastmile.priceDetail.packagingFee ?? 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                  {item.combinedFrom.trunk.priceDetail.packagingFee && item.combinedFrom.lastmile.priceDetail.packagingFee === undefined && (
                                    <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t border-amber-200/60">
                                      注：头程已含包装费，尾程包装费不再重复计入
                                    </p>
                                  )}
                                </div>
                             </div>
                           )}

                           <div className="flex items-center justify-between pt-2 border-t border-dashed border-border bg-gradient-to-r from-emerald-50/50 to-transparent -mx-3 px-3 rounded-sm py-2">
                             <span className="text-sm font-semibold text-emerald-700">组合总计</span>
                             <span className="text-xl font-bold tabular-nums text-emerald-600" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                               ¥{item.totalPrice.toFixed(2)}
                             </span>
                           </div>

                           {item.billingFormula && item.billingFormula.length > 0 && (
                             <div className="pt-2 border-t border-border">
                               <span className="text-[10px] font-medium text-muted-foreground mb-1.5 block">计费过程</span>
                               <div className="bg-accent/40 rounded-sm p-2 space-y-0.5">
                                 {item.billingFormula.map((line: string, idx: number) => (
                                   <p
                                     key={idx}
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
                         </div>
                       ) : (
                      <div className="pt-3 mt-3 border-t border-border space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground w-20 shrink-0">计费方式</span>
                          <span className="font-medium">{item.priceDetail.billingMode}</span>
                        </div>
                        {item.priceDetail.firstWeightPrice !== null && item.priceDetail.continuedWeightPrice !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20 shrink-0">首重/续重</span>
                            <span className="font-medium tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                              首重 ¥{item.priceDetail.firstWeightPrice.toFixed(2)} + 续重 ¥{item.priceDetail.continuedWeightPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {item.priceDetail.unitPrice !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20 shrink-0">单价</span>
                            <span className="font-medium tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                              ¥{item.priceDetail.unitPrice.toFixed(2)}/kg
                            </span>
                          </div>
                        )}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-sm p-3 border border-blue-100 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20 shrink-0">起步价</span>
                            <span className="font-medium tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                              ¥{item.priceDetail.minCharge.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20 shrink-0">重量费用</span>
                            <span className="text-lg font-bold tabular-nums text-primary" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                              ¥{item.priceDetail.weightCharge.toFixed(2)}
                            </span>
                          </div>
                          {item.priceDetail.surchargeItems && item.priceDetail.surchargeItems.length > 0 && item.priceDetail.surchargeItems.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-amber-50/80 rounded-sm px-2 py-1.5 border border-amber-200">
                              <span className="text-amber-800 font-medium text-[11px]">{s.label}</span>
                              <span className="font-bold tabular-nums text-amber-700" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                +¥{s.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {item.priceDetail.packagingFee !== undefined && (
                            <div className="flex items-center justify-between bg-rose-50/80 rounded-sm px-2 py-1.5 border border-rose-200 mt-1">
                              <span className="text-rose-700 font-semibold text-[11px]">包装费 ({item.priceDetail.packagingType})</span>
                              <div className="text-right">
                                <span className="font-bold tabular-nums text-rose-600" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                  +¥{(item.priceDetail.packagingFee ?? 0).toFixed(2)}
                                </span>
                                <p className="text-[10px] text-rose-500 tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                  {item.priceDetail.packagingUnit}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        {item.priceDetail.usedVolumetricWeight && item.priceDetail.volumetricCalculation && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground w-20 shrink-0">记抛计费</span>
                            <div className="flex-1 flex flex-col gap-1">
                              <span className="font-semibold tabular-nums text-amber-700" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                计费重量: {item.priceDetail.volumetricCalculation.actualWeight > item.priceDetail.volumetricCalculation.volumetricWeight
                                  ? item.priceDetail.volumetricCalculation.actualWeight.toFixed(2)
                                  : item.priceDetail.volumetricCalculation.volumetricWeight.toFixed(2)}kg
                              </span>
                              <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                {item.priceDetail.billingMode === 'volumetric_weight'
                                  ? `体积重 ${item.priceDetail.volumetricCalculation.volumetricWeight.toFixed(3)}kg`
                                  : `MAX(实重 ${item.priceDetail.volumetricCalculation.actualWeight.toFixed(2)}kg, 体积重 ${item.priceDetail.volumetricCalculation.volumetricWeight.toFixed(3)}kg)`}
                              </span>
                              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-sm p-2.5 border border-amber-200 mt-1">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[11px] font-bold text-amber-800">体积重计算过程 (÷{item.priceDetail.volumetricCalculation.divisor})</span>
                                  {item.priceDetail.volumetricCalculation.hasWoodenAdjust && (
                                    <span className="text-[10px] font-medium text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded-sm">
                                      木箱膨胀
                                    </span>
                                  )}
                                </div>
                                {(item.priceDetail.volumetricCalculation.groups && item.priceDetail.volumetricCalculation.groups.length > 0
                                  ? item.priceDetail.volumetricCalculation.groups
                                  : [{ length: item.priceDetail.volumetricCalculation.length, width: item.priceDetail.volumetricCalculation.width, height: item.priceDetail.volumetricCalculation.height, quantity: item.priceDetail.volumetricCalculation.quantity }]
                                ).map((g: { length: number; width: number; height: number; quantity: number }, i: number) => {
                                  const adj = item.priceDetail.volumetricCalculation?.adjustedGroups?.[i];
                                  const hasAdj = item.priceDetail.volumetricCalculation?.hasWoodenAdjust && adj;
                                  const groupVol = hasAdj
                                    ? adj.length * adj.width * adj.height * adj.quantity / item.priceDetail.volumetricCalculation!.divisor
                                    : g.length * g.width * g.height * g.quantity / item.priceDetail.volumetricCalculation!.divisor;
                                  return (
                                    <div key={i} className="space-y-0.5">
                                      {hasAdj && (
                                        <p className="text-[10px] text-muted-foreground tabular-nums line-through opacity-60" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                          原始: {g.length}×{g.width}×{g.height}cm × {g.quantity}件
                                        </p>
                                      )}
                                      <p className="text-[11px] text-amber-800 font-medium tabular-nums leading-relaxed" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                        {hasAdj ? `${adj.length}×${adj.width}×${adj.height}cm` : `${g.length}×${g.width}×${g.height}cm`} × {g.quantity}件 ÷ {item.priceDetail.volumetricCalculation!.divisor} = <span className="font-bold text-amber-900">{groupVol.toFixed(3)}kg</span>
                                      </p>
                                    </div>
                                  );
                                })}
                                {(item.priceDetail.volumetricCalculation.groups && item.priceDetail.volumetricCalculation.groups.length > 1) && (
                                  <p className="text-[11px] text-amber-900 font-bold tabular-nums mt-1 pt-1 border-t border-amber-200" style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}>
                                    总体积重 = {item.priceDetail.volumetricCalculation.volumetricWeight.toFixed(3)}kg
                                  </p>
                                )}
                                {item.priceDetail.volumetricCalculation.hasWoodenAdjust && (
                                  <p className="text-[10px] text-rose-600 mt-1.5 pt-1 border-t border-amber-200/60">
                                    膨胀规则: 长+5cm、宽+5cm、高+15cm（含木箱/木架厚度）
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {item.billingFormula && item.billingFormula.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <span className="text-[10px] font-medium text-muted-foreground mb-1.5 block">计费过程</span>
                            <div className="bg-accent/40 rounded-sm p-2 space-y-0.5">
                              {item.billingFormula.map((line: string, idx: number) => (
                                <p
                                  key={idx}
                                  className="text-[11px] leading-relaxed text-foreground tabular-nums"
                                  style={{ fontFamily: 'Roboto Mono, SF Mono, Consolas, monospace' }}
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

export default InquiryResults;
