import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  createPricingRule,
  updatePricingRule,
} from '@client/src/api/logistics-routes';
import type { PricingRuleItem } from '@shared/api.interface';

interface PricingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  editingRule: PricingRuleItem | null;
  onSaved: () => void;
}

interface RuleFormState {
  minWeight: string;
  maxWeight: string;
  unitPrice: string;
  firstWeightPrice: string;
  continuedWeightPrice: string;
  minCharge: string;
  remark: string;
  applicableRegions: string;
  zipCodeRanges: string;
  unitPriceUnit: string;
  woodenBoxPrice: string;
  woodenFramePrice: string;
  fuelSurcharge: string;
  customsClearanceFee: string;
  overPerimeterSurcharge: string;
  overLengthSurcharge: string;
  overWeightSurcharge: string;
  remoteAreaSurcharge: string;
  maxLength: string;
  packageUnit: string;
  taxFee: string;
  routeCode: string;
}

const EMPTY_FORM: RuleFormState = {
  minWeight: '',
  maxWeight: '',
  unitPrice: '',
  firstWeightPrice: '',
  continuedWeightPrice: '',
  minCharge: '',
  remark: '',
  applicableRegions: '',
  zipCodeRanges: '',
  unitPriceUnit: '',
  woodenBoxPrice: '',
  woodenFramePrice: '',
  fuelSurcharge: '',
  customsClearanceFee: '',
  overPerimeterSurcharge: '',
  overLengthSurcharge: '',
  overWeightSurcharge: '',
  remoteAreaSurcharge: '',
  maxLength: '',
  packageUnit: '',
  taxFee: '',
  routeCode: '',
};

const PricingRuleDialog: React.FC<PricingRuleDialogProps> = ({
  open,
  onOpenChange,
  routeId,
  editingRule,
  onSaved,
}) => {
  const [form, setForm] = useState<RuleFormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (editingRule) {
      setForm({
        minWeight: editingRule.minWeight != null ? String(editingRule.minWeight) : '',
        maxWeight: String(editingRule.maxWeight),
        unitPrice: editingRule.unitPrice != null ? String(editingRule.unitPrice) : '',
        firstWeightPrice: editingRule.firstWeightPrice != null ? String(editingRule.firstWeightPrice) : '',
        continuedWeightPrice: editingRule.continuedWeightPrice != null ? String(editingRule.continuedWeightPrice) : '',
        minCharge: String(editingRule.minCharge),
        remark: editingRule.remark || '',
        applicableRegions: editingRule.applicableRegions || '',
        zipCodeRanges: editingRule.zipCodeRanges || '',
        unitPriceUnit: editingRule.unitPriceUnit || '',
        woodenBoxPrice: editingRule.woodenBoxPrice != null ? String(editingRule.woodenBoxPrice) : '',
        woodenFramePrice: editingRule.woodenFramePrice != null ? String(editingRule.woodenFramePrice) : '',
        fuelSurcharge: editingRule.fuelSurcharge || '',
        customsClearanceFee: editingRule.customsClearanceFee != null ? String(editingRule.customsClearanceFee) : '',
        overPerimeterSurcharge: editingRule.overPerimeterSurcharge || '',
        overLengthSurcharge: editingRule.overLengthSurcharge || '',
        overWeightSurcharge: editingRule.overWeightSurcharge || '',
        remoteAreaSurcharge: editingRule.remoteAreaSurcharge || '',
        maxLength: editingRule.maxLength != null ? String(editingRule.maxLength) : '',
        packageUnit: editingRule.packageUnit || '',
        taxFee: editingRule.taxFee || '',
        routeCode: editingRule.routeCode || '',
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [editingRule, open]);

  const updateField = (field: keyof RuleFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const minW: number | null = form.minWeight.trim() === '' ? null : parseFloat(form.minWeight);
    const maxW: number | null = form.maxWeight.trim() === '' ? null : parseFloat(form.maxWeight);

    if (minW !== null && isNaN(minW)) {
      toast.error('请填写有效的最小重量');
      return;
    }
    if (maxW !== null && isNaN(maxW)) {
      toast.error('请填写有效的最大重量');
      return;
    }
    if (minW !== null && maxW !== null && minW >= maxW) {
      toast.error('最小重量必须小于最大重量');
      return;
    }
    if (!form.minCharge.trim()) {
      toast.error('请填写最低收费');
      return;
    }

    const payload = {
      minWeight: minW ?? undefined,
      maxWeight: maxW ?? undefined,
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
      firstWeightPrice: form.firstWeightPrice ? parseFloat(form.firstWeightPrice) : undefined,
      continuedWeightPrice: form.continuedWeightPrice ? parseFloat(form.continuedWeightPrice) : undefined,
      minCharge: form.minCharge.trim(),
      remark: form.remark || undefined,
      applicableRegions: form.applicableRegions || undefined,
      zipCodeRanges: form.zipCodeRanges || undefined,
      unitPriceUnit: form.unitPriceUnit || undefined,
      woodenBoxPrice: form.woodenBoxPrice ? parseFloat(form.woodenBoxPrice) : undefined,
      woodenFramePrice: form.woodenFramePrice ? parseFloat(form.woodenFramePrice) : undefined,
      fuelSurcharge: form.fuelSurcharge || undefined,
      customsClearanceFee: form.customsClearanceFee ? form.customsClearanceFee.trim() : undefined,
      overPerimeterSurcharge: form.overPerimeterSurcharge || undefined,
      overLengthSurcharge: form.overLengthSurcharge || undefined,
      overWeightSurcharge: form.overWeightSurcharge || undefined,
      remoteAreaSurcharge: form.remoteAreaSurcharge || undefined,
      maxLength: form.maxLength ? parseFloat(form.maxLength) : undefined,
      packageUnit: form.packageUnit || undefined,
      taxFee: form.taxFee || undefined,
      routeCode: form.routeCode.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editingRule) {
        await updatePricingRule(editingRule.id, payload);
        toast.success('报价规则更新成功');
      } else {
        await createPricingRule(routeId, payload);
        toast.success('报价规则创建成功');
      }
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(editingRule ? '更新失败' : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit: boolean = editingRule !== null;
  const title: string = isEdit ? '编辑报价规则' : '新增报价规则';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            填写重量段和价格信息，重量段不可与已有规则重叠
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">
              最小重量(kg) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form.minWeight}
              onChange={(e) => updateField('minWeight', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">
              最大重量(kg) <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form.maxWeight}
              onChange={(e) => updateField('maxWeight', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">单价(元/kg)</Label>
            <Input type="number" step="0.01" value={form.unitPrice} onChange={(e) => updateField('unitPrice', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">首重价格(元)</Label>
            <Input type="number" step="0.01" value={form.firstWeightPrice} onChange={(e) => updateField('firstWeightPrice', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">续重价格(元)</Label>
            <Input type="number" step="0.01" value={form.continuedWeightPrice} onChange={(e) => updateField('continuedWeightPrice', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">
              最低收费(元) <span className="text-red-500">*</span>
            </Label>
            <Input value={form.minCharge} onChange={(e) => updateField('minCharge', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">适用区域</Label>
            <Input value={form.applicableRegions} onChange={(e) => updateField('applicableRegions', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">邮编范围</Label>
            <Input value={form.zipCodeRanges} onChange={(e) => updateField('zipCodeRanges', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">计价单位</Label>
            <Input value={form.unitPriceUnit} onChange={(e) => updateField('unitPriceUnit', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">包装单位</Label>
            <Input value={form.packageUnit} onChange={(e) => updateField('packageUnit', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">木箱包装费(元)</Label>
            <Input type="number" step="0.01" value={form.woodenBoxPrice} onChange={(e) => updateField('woodenBoxPrice', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">木架包装费(元)</Label>
            <Input type="number" step="0.01" value={form.woodenFramePrice} onChange={(e) => updateField('woodenFramePrice', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">燃油附加费</Label>
            <Input value={form.fuelSurcharge} onChange={(e) => updateField('fuelSurcharge', e.target.value)} placeholder="如：10%、0.5元/kg" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">清关费(元)</Label>
            <Input value={form.customsClearanceFee} onChange={(e) => updateField('customsClearanceFee', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">税费</Label>
            <Input value={form.taxFee} onChange={(e) => updateField('taxFee', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm font-medium text-muted-foreground">最大长度限制(cm)</Label>
            <Input type="number" step="0.1" value={form.maxLength} onChange={(e) => updateField('maxLength', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">超周长附加费</Label>
            <Input value={form.overPerimeterSurcharge} onChange={(e) => updateField('overPerimeterSurcharge', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">超长附加费</Label>
            <Input value={form.overLengthSurcharge} onChange={(e) => updateField('overLengthSurcharge', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">超重附加费</Label>
            <Input value={form.overWeightSurcharge} onChange={(e) => updateField('overWeightSurcharge', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">偏远地区附加费</Label>
            <Input value={form.remoteAreaSurcharge} onChange={(e) => updateField('remoteAreaSurcharge', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">
              关联线路编号 (routeCode)
            </Label>
            <Input
              value={form.routeCode}
              onChange={(e) => updateField('routeCode', e.target.value)}
              placeholder="如 XP-001，与 logistics_route.route_code 匹配时自动填入 route_id"
            />
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">备注</Label>
            <Input value={form.remark} onChange={(e) => updateField('remark', e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PricingRuleDialog;
