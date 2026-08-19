import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import PricingRulesTab from './PricingRulesTab';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  getRouteDetail,
  updateRoute,
  deletePricingRule,
} from '@client/src/api/logistics-routes';
import type {
  LogisticsRouteDetail,
  PricingRuleItem,
} from '@shared/api.interface';
import PricingRuleDialog from './PricingRuleDialog';

interface RouteDetailSheetProps {
  routeId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

interface BasicInfoForm {
  name: string;
  coverCountries: string;
  coverCities: string;
  postalCodeRange: string;
  supportedCategories: string;
}

const RouteDetailSheet: React.FC<RouteDetailSheetProps> = ({
  routeId,
  open,
  onClose,
  onRefresh,
}) => {
  const [detail, setDetail] = useState<LogisticsRouteDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [basicForm, setBasicForm] = useState<BasicInfoForm>({
    name: '', coverCountries: '', coverCities: '',
    postalCodeRange: '', supportedCategories: '',
  });
  const [savingBasic, setSavingBasic] = useState<boolean>(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<PricingRuleItem | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    try {
      const data: LogisticsRouteDetail = await getRouteDetail(routeId);
      setDetail(data);
      setBasicForm({
        name: data.name,
        coverCountries: data.coverCountries,
        coverCities: data.coverCities,
        postalCodeRange: data.postalCodeRange,
        supportedCategories: data.supportedCategories,
      });
    } catch {
      toast.error('获取线路详情失败');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (open && routeId) {
      setActiveTab('basic');
      fetchDetail();
    }
  }, [open, routeId, fetchDetail]);

  const handleSaveBasic = async () => {
    if (!routeId || !basicForm.name.trim() || !basicForm.coverCountries.trim()) {
      toast.error('线路名称和覆盖国家为必填');
      return;
    }
    setSavingBasic(true);
    try {
      await updateRoute(routeId, {
        name: basicForm.name,
        coverCountries: basicForm.coverCountries,
        coverCities: basicForm.coverCities,
        postalCodeRange: basicForm.postalCodeRange,
        supportedCategories: basicForm.supportedCategories,
      });
      toast.success('基础信息已保存');
      onRefresh();
      fetchDetail();
    } catch {
      toast.error('保存失败');
    } finally {
      setSavingBasic(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRuleId) return;
    try {
      await deletePricingRule(deleteRuleId);
      toast.success('报价规则已删除');
      setDeleteRuleId(null);
      fetchDetail();
      onRefresh();
    } catch {
      toast.error('删除失败');
    }
  };

  const openAddRule = () => {
    setEditingRule(null);
    setRuleDialogOpen(true);
  };

  const openEditRule = (rule: PricingRuleItem) => {
    setEditingRule(rule);
    setRuleDialogOpen(true);
  };

  const handleRuleSaved = () => {
    fetchDetail();
    onRefresh();
  };

  const updateBasicField = (field: keyof BasicInfoForm, val: string) => {
    setBasicForm((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="text-base">
              {loading ? '加载中...' : detail?.name || '线路详情'}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 px-6 pt-4">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1 text-xs">基础信息</TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1 text-xs">报价规则</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">线路名称</Label>
                  <Input value={basicForm.name} onChange={(e) => updateBasicField('name', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">覆盖国家/地区</Label>
                  <Input value={basicForm.coverCountries} onChange={(e) => updateBasicField('coverCountries', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">覆盖城市</Label>
                  <Input value={basicForm.coverCities} onChange={(e) => updateBasicField('coverCities', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">邮编范围</Label>
                  <Input value={basicForm.postalCodeRange} onChange={(e) => updateBasicField('postalCodeRange', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">支持品类</Label>
                  <Input value={basicForm.supportedCategories} onChange={(e) => updateBasicField('supportedCategories', e.target.value)} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveBasic} disabled={savingBasic} size="sm">
                    {savingBasic ? '保存中...' : '保存基础信息'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="mt-4">
              <PricingRulesTab
                rules={detail?.pricingRules || []}
                onAdd={openAddRule}
                onEdit={openEditRule}
                onDelete={setDeleteRuleId}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {routeId && (
        <PricingRuleDialog
          open={ruleDialogOpen}
          onOpenChange={setRuleDialogOpen}
          routeId={routeId}
          editingRule={editingRule}
          onSaved={handleRuleSaved}
        />
      )}

      <AlertDialog open={deleteRuleId !== null} onOpenChange={(o) => { if (!o) setDeleteRuleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除该报价规则吗？此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RouteDetailSheet;
