import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@client/src/components/ui/form';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Info, Search, AlertTriangle, Package, ClipboardPaste, X, Check } from 'lucide-react';
import type { Control } from 'react-hook-form';
import type { DimensionGroup, RouteDimensionLimit } from '@shared/api.interface';
import { getDimensionLimits } from '@client/src/api/logistics-routes';
import { useInputHistory } from './hooks/useInputHistory';
import { HistoryInput } from './components/HistoryInput';
import { parseInquiryText } from './utils/parseInquiryText';
import type { ParsedInquiryFields } from './utils/parseInquiryText';

const PACKAGING_OPTIONS = [
  { value: '纸箱', label: '纸箱' },
  { value: '编织袋', label: '编织袋' },
  { value: '已有木箱', label: '已有木箱' },
  { value: '需打木箱', label: '需打木箱' },
  { value: '已有木架', label: '已有木架' },
  { value: '需打木架', label: '需打木架' },
  { value: '托盘', label: '托盘' },
];

const CATEGORY_OPTIONS = [
  { value: '普货', label: '普货' },
  { value: '带电', label: '带电' },
  { value: '带磁', label: '带磁' },
  { value: '纯电', label: '纯电' },
  { value: '危险品', label: '危险品' },
  { value: '液体/粉末/膏体', label: '液体/粉末/膏体' },
  { value: '食品', label: '食品' },
  { value: '易碎品', label: '易碎品' },
];

const CUSTOMS_OPTIONS = [
  { value: '不指定', label: '不指定（全部匹配）' },
  { value: '需要单独报关', label: '需要单独报关' },
  { value: '无需报关', label: '无需报关' },
];

const inquiryFormSchema = z.object({
  country: z.string().min(1, '请输入目的国家/地区'),
  city: z.string().optional().default(''),
  postalCode: z.string().optional().default(''),
  weight: z.coerce.number().positive('请输入正数').min(0.01, '重量必须大于 0'),
  length: z.coerce.number().min(0, '必须为非负数').optional().default(0),
  width: z.coerce.number().min(0, '必须为非负数').optional().default(0),
  height: z.coerce.number().min(0, '必须为非负数').optional().default(0),
  quantity: z.coerce.number().int('必须为正整数').min(1, '至少 1 件'),
  category: z.string().optional().default(''),
  packagingType: z.string().optional().default(''),
  declaredValue: z.coerce.number().min(0, '必须为非负数').optional().default(0),
  packagesCount: z.coerce.number().int('必须为正整数').min(1, '至少 1 件').optional().default(1),
  itemName: z.string().optional().default(''),
  customsType: z.string().optional().default('不指定'),
});

type InquiryFormValues = z.infer<typeof inquiryFormSchema>;

interface InquiryFormProps {
  onSubmit: (data: InquiryFormValues) => void;
  loading: boolean;
  initialValues?: Partial<InquiryFormValues>;
}

type InquiryFormControl = Control<InquiryFormValues>;

const FL = 'text-sm font-medium text-muted-foreground';

interface HistoryInputFieldProps {
  control: InquiryFormControl;
  name: keyof InquiryFormValues;
  label: string;
  placeholder: string;
  history: string[];
  onClearHistory: () => void;
}

const HistoryTextField = ({
  control, name, label, placeholder, history, onClearHistory,
}: HistoryInputFieldProps) => (
  <FormField control={control} name={name} render={({ field }) => (
    <FormItem>
      <FormLabel className={FL}>{label}</FormLabel>
      <FormControl>
        <HistoryInput
          value={String(field.value || '')}
          onChange={field.onChange}
          placeholder={placeholder}
          history={history}
          onClearHistory={onClearHistory}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )} />
);

const HistoryNumberField = ({
  control, name, label, placeholder, step = '1', history, onClearHistory,
}: HistoryInputFieldProps & { step?: string }) => (
  <FormField control={control} name={name} render={({ field }) => (
    <FormItem>
      <FormLabel className={FL}>{label}</FormLabel>
      <FormControl>
        <HistoryInput
          type="number"
          step={step}
          value={String(field.value || '')}
          onChange={(val) => field.onChange(val === '' ? undefined : Number(val))}
          placeholder={placeholder}
          history={history}
          onClearHistory={onClearHistory}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )} />
);

const InquiryForm = ({ onSubmit, loading, initialValues }: InquiryFormProps) => {
  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: {
      country: initialValues?.country ?? '',
      city: initialValues?.city ?? '',
      postalCode: initialValues?.postalCode ?? '',
      weight: initialValues?.weight ?? undefined,
      length: initialValues?.length ?? undefined,
      width: initialValues?.width ?? undefined,
      height: initialValues?.height ?? undefined,
      quantity: initialValues?.quantity ?? 1,
      packagesCount: initialValues?.packagesCount ?? 1,
      category: initialValues?.category ?? '',
      packagingType: initialValues?.packagingType ?? '',
      declaredValue: initialValues?.declaredValue ?? undefined,
      itemName: initialValues?.itemName ?? '',
      customsType: initialValues?.customsType ?? '不指定',
    },
  });

  const { control, handleSubmit, getValues } = form;
  const [dimensionMode, setDimensionMode] = useState<'same' | 'different'>('same');
  const [dimensionGroups, setDimensionGroups] = useState<DimensionGroupField[]>([
    { length: 0, width: 0, height: 0, quantity: 1 },
  ]);
  const [dimensionLimits, setDimensionLimits] = useState<RouteDimensionLimit[]>([]);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<ParsedInquiryFields | null>(null);

  // 历史输入功能
  const { getFieldHistory, addHistory, clearHistory } = useInputHistory();

  // 获取各字段历史记录
  const countryHistory = getFieldHistory('country');
  const cityHistory = getFieldHistory('city');
  const postalCodeHistory = getFieldHistory('postalCode');
  const weightHistory = getFieldHistory('weight');
  const lengthHistory = getFieldHistory('length');
  const widthHistory = getFieldHistory('width');
  const heightHistory = getFieldHistory('height');
  const quantityHistory = getFieldHistory('quantity');
  const packagesCountHistory = getFieldHistory('packagesCount');
  const declaredValueHistory = getFieldHistory('declaredValue');

  const watchedLength = useWatch({ control, name: 'length' });
  const watchedWidth = useWatch({ control, name: 'width' });
  const watchedHeight = useWatch({ control, name: 'height' });
  const watchedPackages = useWatch({ control, name: 'packagesCount' });
  const watchedPackaging = useWatch({ control, name: 'packagingType' });

  useEffect(() => {
    getDimensionLimits()
      .then((res) => setDimensionLimits(res.items))
      .catch(() => setDimensionLimits([]));
  }, []);

  const dimensionErrors = useMemo(() => {
    const errors: {
      length: string[];
      width: string[];
      height: string[];
      longestSide: string[];
      sumDimension: string[];
    } = {
      length: [],
      width: [],
      height: [],
      longestSide: [],
      sumDimension: [],
    };

    if (!dimensionLimits.length) return errors;

    const dims = [
      Number(watchedLength) || 0,
      Number(watchedWidth) || 0,
      Number(watchedHeight) || 0,
    ];
    const maxDim = Math.max(...dims);
    const sumDims = dims[0] + dims[1] + dims[2];

    // 只针对平台官方线路（名称包含'示例平台'）显示尺寸超限提醒
    if (watchedLength && Number(watchedLength) > 0) {
      dimensionLimits.forEach((route: RouteDimensionLimit) => {
        if (route.routeName.includes('示例平台') && route.lengthLimit && Number(watchedLength) > route.lengthLimit) {
          errors.length.push(route.routeName);
        }
      });
    }

    if (watchedWidth && Number(watchedWidth) > 0) {
      dimensionLimits.forEach((route: RouteDimensionLimit) => {
        if (route.routeName.includes('示例平台') && route.widthLimit && Number(watchedWidth) > route.widthLimit) {
          errors.width.push(route.routeName);
        }
      });
    }

    if (watchedHeight && Number(watchedHeight) > 0) {
      dimensionLimits.forEach((route: RouteDimensionLimit) => {
        if (route.routeName.includes('示例平台') && route.heightLimit && Number(watchedHeight) > route.heightLimit) {
          errors.height.push(route.routeName);
        }
      });
    }

    // 只针对平台官方线路（名称包含'示例平台'）显示尺寸超限提醒
    if (maxDim > 0) {
      dimensionLimits.forEach((route: RouteDimensionLimit) => {
        if (route.routeName.includes('示例平台') && route.longestSideLimit && maxDim > route.longestSideLimit) {
          errors.longestSide.push(`${route.routeName}(≤${route.longestSideLimit}cm)`);
        }
      });
    }

    if (sumDims > 0) {
      dimensionLimits.forEach((route: RouteDimensionLimit) => {
        if (route.routeName.includes('示例平台') && route.sumDimensionLimit && sumDims > route.sumDimensionLimit) {
          errors.sumDimension.push(`${route.routeName}(≤${route.sumDimensionLimit}cm)`);
        }
      });
    }

    return errors;
  }, [watchedLength, watchedWidth, watchedHeight, dimensionLimits]);

  const needWoodenAdjust = watchedPackaging === '需打木箱' || watchedPackaging === '需打木架';

  const volumetricWeight = (() => {
    if (dimensionMode === 'different') {
      const totalVol = dimensionGroups.reduce((sum, g) => {
        if (g.length && g.width && g.height && g.quantity) {
          const l = needWoodenAdjust ? g.length + 5 : g.length;
          const w = needWoodenAdjust ? g.width + 5 : g.width;
          const h = needWoodenAdjust ? g.height + 15 : g.height;
          return sum + l * w * h * g.quantity;
        }
        return sum;
      }, 0);
      return totalVol > 0 ? (totalVol / 6000).toFixed(2) : null;
    }
    if (watchedLength && watchedWidth && watchedHeight && watchedPackages) {
      const l = needWoodenAdjust ? Number(watchedLength) + 5 : Number(watchedLength);
      const w = needWoodenAdjust ? Number(watchedWidth) + 5 : Number(watchedWidth);
      const h = needWoodenAdjust ? Number(watchedHeight) + 15 : Number(watchedHeight);
      return (l * w * h * Number(watchedPackages) / 6000).toFixed(2);
    }
    return null;
  })();

  const showPackagingWarning =
    watchedPackaging === '需打木架' || watchedPackaging === '需打木箱';

  const handleFormSubmit = (data: InquiryFormValues) => {
    // 保存到历史记录
     addHistory({
       country: data.country,
       city: data.city || '',
       postalCode: data.postalCode || '',
       weight: String(data.weight),
       length: String(data.length || ''),
       width: String(data.width || ''),
       height: String(data.height || ''),
       quantity: String(data.quantity),
       packagesCount: String(data.packagesCount || ''),
       category: data.category || '',
       packagingType: data.packagingType || '',
        declaredValue: String(data.declaredValue || ''),
        itemName: data.itemName || '',
        customsType: data.customsType || '不指定',
        selectedRoute: '',
     });

    if (dimensionMode === 'different') {
      const validGroups = dimensionGroups.filter((g) => g.length && g.width && g.height && g.quantity);
      onSubmit({ ...data, dimensionGroups: validGroups } as InquiryFormValues & { dimensionGroups?: DimensionGroup[] });
    } else {
      onSubmit(data);
    }
  };

  return (
    <div className="bg-card rounded-sm shadow-sm border border-border p-5">
      <p className="text-sm text-muted-foreground mb-5">
        物流询价结果仅作参考，具体实时邮费仍需与货代进一步沟通
      </p>
      <Form {...form}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* 目的地 */}
          <HistoryTextField control={control} name="country" label="目的国家/地区 *" placeholder="如：美国" history={countryHistory} onClearHistory={clearHistory} />

          <div className="grid grid-cols-2 gap-4">
            <HistoryTextField control={control} name="city" label="城市" placeholder="选填" history={cityHistory} onClearHistory={clearHistory} />
            <HistoryTextField control={control} name="postalCode" label="邮编" placeholder="选填" history={postalCodeHistory} onClearHistory={clearHistory} />
          </div>

          {/* 重量与件数 */}
          <div className="border-t border-border pt-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <HistoryNumberField control={control} name="weight" label="实重 (kg) *" placeholder="如：2.5" step="0.01" history={weightHistory} onClearHistory={clearHistory} />
              <HistoryNumberField control={control} name="quantity" label="件数 *" placeholder="1" history={quantityHistory} onClearHistory={clearHistory} />
            </div>
          </div>

          {/* 包裹尺寸 */}
          <div className="border-t border-border pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-foreground" />
                <span className="text-sm font-medium text-foreground">包裹尺寸 (cm)</span>
              </div>
            </div>

            {/* 尺寸模式切换 */}
            <div className="flex gap-1 mb-3">
              <button
                type="button"
                onClick={() => setDimensionMode('same')}
                className={`px-3 py-1 text-xs rounded-sm border transition-colors ${
                  dimensionMode === 'same'
                    ? 'border-primary text-primary bg-accent'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                所有包裹尺寸相同
              </button>
              <button
                type="button"
                onClick={() => {
                  setDimensionMode('different');
                  if (dimensionGroups.length === 0) {
                    setDimensionGroups([{ length: 0, width: 0, height: 0, quantity: 1 }]);
                  }
                }}
                className={`px-3 py-1 text-xs rounded-sm border transition-colors ${
                  dimensionMode === 'different'
                    ? 'border-primary text-primary bg-accent'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                包裹尺寸各不相同
              </button>
            </div>

            {dimensionMode === 'same' ? (
              <div className="grid grid-cols-3 gap-4">
                <FormField control={control} name="length" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FL}>长</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="选填" {...field} /></FormControl>
                    {dimensionErrors.length.length > 0 && (
                      <div className="text-[11px] text-red-600 mt-1 space-y-0.5">
                        {dimensionErrors.length.slice(0, 3).map((routeName, idx) => (
                          <p key={idx}>当前长超出{routeName}的长度限制</p>
                        ))}
                        {dimensionErrors.length.length > 3 && (
                          <p>当前长超出{dimensionErrors.length.length - 3}条其他线路的长度限制</p>
                        )}
                      </div>
                    )}
                  </FormItem>
                )} />
                <FormField control={control} name="width" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FL}>宽</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="选填" {...field} /></FormControl>
                    {dimensionErrors.width.length > 0 && (
                      <div className="text-[11px] text-red-600 mt-1 space-y-0.5">
                        {dimensionErrors.width.slice(0, 3).map((routeName, idx) => (
                          <p key={idx}>当前宽超出{routeName}的宽度限制</p>
                        ))}
                        {dimensionErrors.width.length > 3 && (
                          <p>当前宽超出{dimensionErrors.width.length - 3}条其他线路的宽度限制</p>
                        )}
                      </div>
                    )}
                  </FormItem>
                )} />
                <FormField control={control} name="height" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FL}>高</FormLabel>
                    <FormControl><Input type="number" step="0.1" placeholder="选填" {...field} /></FormControl>
                    {dimensionErrors.height.length > 0 && (
                      <div className="text-[11px] text-red-600 mt-1 space-y-0.5">
                        {dimensionErrors.height.slice(0, 3).map((routeName, idx) => (
                          <p key={idx}>当前高超出{routeName}的高度限制</p>
                        ))}
                        {dimensionErrors.height.length > 3 && (
                          <p>当前高超出{dimensionErrors.height.length - 3}条其他线路的高度限制</p>
                        )}
                      </div>
                    )}
                  </FormItem>
                )} />
              </div>
            ) : (
              <MultiDimensionForm groups={dimensionGroups} onChange={setDimensionGroups} />
            )}

              {/* 最长边/三边之和超限提示 */}
            {(dimensionErrors.longestSide.length > 0 || dimensionErrors.sumDimension.length > 0) && (
              <div className="mt-2 bg-red-50 border border-red-100 rounded-sm px-3 py-2 space-y-1">
                {dimensionErrors.longestSide.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-[11px] text-red-600">
                      <p className="font-medium">最长边超出以下平台官方线路限制:</p>
                      <p className="mt-0.5">
                        {dimensionErrors.longestSide.slice(0, 5).join('、')}
                        {dimensionErrors.longestSide.length > 5 && `等${dimensionErrors.longestSide.length}条线路`}
                      </p>
                    </div>
                  </div>
                )}
                {dimensionErrors.sumDimension.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-[11px] text-red-600">
                      <p className="font-medium">三边之和(长+宽+高)超出以下平台官方线路限制:</p>
                      <p className="mt-0.5">
                        {dimensionErrors.sumDimension.slice(0, 5).join('、')}
                        {dimensionErrors.sumDimension.length > 5 && `等${dimensionErrors.sumDimension.length}条线路`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 体积重预览 */}
            <div className="mt-2 min-h-[20px]">
              {volumetricWeight ? (
                <p className="text-xs text-muted-foreground">
                  体积重:{' '}
                  <span className="font-medium text-foreground font-mono">
                    {volumetricWeight}kg
                  </span>
                  {needWoodenAdjust && (
                    <span className="text-amber-600">
                      {' '}（木箱/木架膨胀: 长宽各+5cm, 高+15cm）
                    </span>
                  )}
                  {!needWoodenAdjust && (
                    <span>
                      {' '}（按长×宽×高÷6000估算，实际计费以各路线规则为准）
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  填写尺寸后自动计算体积重
                </p>
              )}
            </div>
          </div>

          {/* 包装信息 */}
          <div className="border-t border-border pt-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <HistoryNumberField control={control} name="packagesCount" label="一票包裹总件数" placeholder="1" history={packagesCountHistory} onClearHistory={clearHistory} />
              <FormField control={control} name="packagingType" render={({ field }) => (
                <FormItem>
                  <FormLabel className={FL}>包装类别</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选填" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PACKAGING_OPTIONS.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* 木架/木箱包装费提示 */}
            {showPackagingWarning && (
              <div className="flex items-start gap-1.5 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-600">
                  部分货代对木架/木箱包装额外收费，具体费用以货代实际报价为准
                </p>
              </div>
            )}
          </div>

          {/* 物品类别 & 申报价值 & 物品名称 */}
          <div className="border-t border-border pt-4 mt-2">
            <div className="grid grid-cols-3 gap-4">
              <FormField control={control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className={FL}>物品类别</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="不指定（全部匹配）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField
                control={control}
                name="itemName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FL}>物品名称</FormLabel>
                    <FormControl>
                      <Input placeholder="如：手机壳、服装等" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <HistoryNumberField control={control} name="declaredValue" label="申报价值 (元)" placeholder="选填" step="0.01" history={declaredValueHistory} onClearHistory={clearHistory} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField control={control} name="customsType" render={({ field }) => (
                <FormItem>
                  <FormLabel className={FL}>是否需要单独报关</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || '不指定'}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="不指定（全部匹配）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CUSTOMS_OPTIONS.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div />
            </div>
          </div>


          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setPasteText(''); setPastePreview(null); setPasteOpen(true); }}
            >
              <ClipboardPaste className="w-4 h-4 mr-2" />
              粘贴识别
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? '询价中...' : '立即询价'}
            </Button>
          </div>
        </form>
      </Form>
      {/* 粘贴识别弹窗 */}
      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-sm shadow-lg border border-border w-[520px] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">粘贴文本智能识别</h3>
              <button type="button" onClick={() => setPasteOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
              <textarea
                className="w-full h-40 border border-border rounded-sm p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                placeholder={"粘贴物流需求文本，例如：\n发到美国纽约 邮编10001\n实重15kg 3箱\n尺寸 40*30*20cm\n纸箱包装 品名：手机壳"}
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPastePreview(null); }}
              />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!pasteText.trim()}
                onClick={() => {
                  const parsed = parseInquiryText(pasteText);
                  setPastePreview(parsed);
                }}
              >
                识别内容
              </Button>

              {pastePreview && (
                <div className="border border-border rounded-sm p-3 space-y-2 bg-accent/30">
                  <p className="text-xs font-medium text-muted-foreground">识别结果：</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {pastePreview.country && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">国家</span>
                        <span className="font-medium text-foreground">{pastePreview.country}</span>
                      </div>
                    )}
                    {pastePreview.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">城市</span>
                        <span className="font-medium text-foreground">{pastePreview.city}</span>
                      </div>
                    )}
                    {pastePreview.postalCode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">邮编</span>
                        <span className="font-medium text-foreground font-mono">{pastePreview.postalCode}</span>
                      </div>
                    )}
                    {pastePreview.weight && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">实重</span>
                        <span className="font-medium text-foreground font-mono">{pastePreview.weight} kg</span>
                      </div>
                    )}
                    {pastePreview.quantity && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">件数</span>
                        <span className="font-medium text-foreground font-mono">{pastePreview.quantity}</span>
                      </div>
                    )}
                    {pastePreview.packagesCount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">包裹数</span>
                        <span className="font-medium text-foreground font-mono">{pastePreview.packagesCount}</span>
                      </div>
                    )}
                    {pastePreview.length && pastePreview.width && pastePreview.height && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">尺寸</span>
                        <span className="font-medium text-foreground font-mono">
                          {pastePreview.length} x {pastePreview.width} x {pastePreview.height} cm
                        </span>
                      </div>
                    )}
                    {pastePreview.dimensionGroups && pastePreview.dimensionGroups.length > 1 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">多尺寸组：</span>
                        {pastePreview.dimensionGroups.map((g, i) => (
                          <span key={i} className="inline-block ml-2 font-mono text-foreground">
                            {g.quantity}x [{g.length}*{g.width}*{g.height}cm]
                          </span>
                        ))}
                      </div>
                    )}
                    {pastePreview.packagingType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">包装</span>
                        <span className="font-medium text-foreground">{pastePreview.packagingType}</span>
                      </div>
                    )}
                    {pastePreview.category && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">类别</span>
                        <span className="font-medium text-foreground">{pastePreview.category}</span>
                      </div>
                    )}
                    {pastePreview.itemName && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-muted-foreground">品名</span>
                        <span className="font-medium text-foreground">{pastePreview.itemName}</span>
                      </div>
                    )}
                    {pastePreview.declaredValue && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">申报价值</span>
                        <span className="font-medium text-foreground font-mono">¥{pastePreview.declaredValue}</span>
                      </div>
                    )}
                    {pastePreview.customsType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">报关方式</span>
                        <span className="font-medium text-foreground">{pastePreview.customsType}</span>
                      </div>
                    )}
                  </div>
                  {Object.keys(pastePreview).length === 0 && (
                    <p className="text-xs text-muted-foreground">未识别到有效信息，请检查文本格式</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" onClick={() => setPasteOpen(false)}>取消</Button>
              <Button
                disabled={!pastePreview || Object.keys(pastePreview).filter((k) => k !== 'dimensionGroups' || (pastePreview.dimensionGroups && pastePreview.dimensionGroups.length > 0)).length === 0}
                onClick={() => {
                  if (!pastePreview) return;
                  const { setValue } = form;
                  if (pastePreview.country) setValue('country', pastePreview.country);
                  if (pastePreview.city) setValue('city', pastePreview.city);
                  if (pastePreview.postalCode) setValue('postalCode', pastePreview.postalCode);
                  if (pastePreview.weight) setValue('weight', pastePreview.weight);
                  if (pastePreview.quantity) setValue('quantity', pastePreview.quantity);
                  if (pastePreview.packagesCount) setValue('packagesCount', pastePreview.packagesCount);
                  if (pastePreview.declaredValue) setValue('declaredValue', pastePreview.declaredValue);
                  if (pastePreview.itemName) setValue('itemName', pastePreview.itemName);
                  if (pastePreview.packagingType) setValue('packagingType', pastePreview.packagingType);
                   if (pastePreview.category) setValue('category', pastePreview.category);
                   if (pastePreview.customsType) setValue('customsType', pastePreview.customsType);

                   if (pastePreview.dimensionGroups && pastePreview.dimensionGroups.length > 1) {
                    setDimensionMode('different');
                    setDimensionGroups(pastePreview.dimensionGroups.map((g) => ({
                      length: g.length,
                      width: g.width,
                      height: g.height,
                      quantity: g.quantity,
                    })));
                  } else if (pastePreview.length && pastePreview.width && pastePreview.height) {
                    setDimensionMode('same');
                    setValue('length', pastePreview.length);
                    setValue('width', pastePreview.width);
                    setValue('height', pastePreview.height);
                  }

                  setPasteOpen(false);
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                填入表单
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DimensionGroupField {
  length: number;
  width: number;
  height: number;
  quantity: number;
}

interface MultiDimensionFormProps {
  groups: DimensionGroupField[];
  onChange: (groups: DimensionGroupField[]) => void;
}

const MultiDimensionForm = ({ groups, onChange }: MultiDimensionFormProps) => {
  const updateGroup = (index: number, field: keyof DimensionGroupField, value: number) => {
    const next = [...groups];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addGroup = () => {
    onChange([...groups, { length: 0, width: 0, height: 0, quantity: 1 }]);
  };

  const removeGroup = (index: number) => {
    if (groups.length <= 1) return;
    onChange(groups.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={i} className="border border-border rounded-sm p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">尺寸组 {i + 1}</span>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => removeGroup(i)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                删除
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">长 (cm)</label>
              <Input
                type="number"
                step="0.1"
                value={g.length || ''}
                onChange={(e) => updateGroup(i, 'length', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">宽 (cm)</label>
              <Input
                type="number"
                step="0.1"
                value={g.width || ''}
                onChange={(e) => updateGroup(i, 'width', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">高 (cm)</label>
              <Input
                type="number"
                step="0.1"
                value={g.height || ''}
                onChange={(e) => updateGroup(i, 'height', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">件数</label>
              <Input
                type="number"
                step="1"
                min="1"
                value={g.quantity || ''}
                onChange={(e) => updateGroup(i, 'quantity', parseInt(e.target.value) || 1)}
                placeholder="1"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addGroup}
        className="text-xs text-primary hover:underline transition-colors"
      >
        + 添加尺寸组
      </button>
    </div>
  );
};

export default InquiryForm;
