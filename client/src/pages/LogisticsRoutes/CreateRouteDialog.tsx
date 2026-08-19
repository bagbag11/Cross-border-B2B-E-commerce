import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
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
import { createRoute } from '@client/src/api/logistics-routes';
import type { CreateLogisticsRouteRequest } from '@shared/api.interface';

interface CreateRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

const INITIAL_FORM: CreateLogisticsRouteRequest = {
  name: '',
  coverCountries: '',
  coverCities: '',
  postalCodeRange: '',
  supportedCategories: '',
};

const CreateRouteDialog: React.FC<CreateRouteDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [form, setForm] = useState<CreateLogisticsRouteRequest>({ ...INITIAL_FORM });
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleFieldChange = (field: keyof CreateLogisticsRouteRequest, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('请输入线路名称');
      return;
    }
    if (!form.coverCountries.trim()) {
      toast.error('请输入覆盖国家/地区');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRoute(form);
      toast.success('线路创建成功');
      onOpenChange(false);
      setForm({ ...INITIAL_FORM });
      onCreated(result.id);
    } catch {
      toast.error('创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setForm({ ...INITIAL_FORM });
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建物流线路</DialogTitle>
          <DialogDescription>填写线路基础信息，创建后可继续配置报价规则</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              线路名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="如：美国专线-标准"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              覆盖国家/地区 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.coverCountries}
              onChange={(e) => handleFieldChange('coverCountries', e.target.value)}
              placeholder="如：美国,加拿大"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">覆盖城市</Label>
            <Input
              value={form.coverCities}
              onChange={(e) => handleFieldChange('coverCities', e.target.value)}
              placeholder="如：纽约,洛杉矶,多伦多"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">邮编范围</Label>
            <Input
              value={form.postalCodeRange}
              onChange={(e) => handleFieldChange('postalCodeRange', e.target.value)}
              placeholder="如：10001-99999"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">支持品类</Label>
            <Input
              value={form.supportedCategories}
              onChange={(e) => handleFieldChange('supportedCategories', e.target.value)}
              placeholder="如：普货,电子产品"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRouteDialog;
