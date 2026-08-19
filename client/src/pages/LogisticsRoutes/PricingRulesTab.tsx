import React from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import type { PricingRuleItem } from '@shared/api.interface';

interface PricingRulesTabProps {
  rules: PricingRuleItem[];
  onAdd: () => void;
  onEdit: (rule: PricingRuleItem) => void;
  onDelete: (ruleId: string) => void;
}

const PricingRulesTab: React.FC<PricingRulesTabProps> = ({
  rules,
  onAdd,
  onEdit,
  onDelete,
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-muted-foreground">
          共 {rules.length} 条规则
        </span>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 新增规则
        </Button>
      </div>
      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">重量段(kg)</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">单价</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">首重</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">续重</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground">最低收费</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">备注</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                  暂无报价规则，点击上方按钮新增
                </td>
              </tr>
            )}
            {rules.map((rule: PricingRuleItem) => (
              <tr key={rule.id} className="border-b border-border last:border-0 h-10">
                <td className="px-2 py-1.5 font-mono tabular-nums whitespace-nowrap">
                  {rule.minWeight} - {rule.maxWeight}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {rule.unitPrice != null ? rule.unitPrice.toFixed(2) : '-'}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {rule.firstWeightPrice != null ? rule.firstWeightPrice.toFixed(2) : '-'}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {rule.continuedWeightPrice != null ? rule.continuedWeightPrice.toFixed(2) : '-'}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {rule.minCharge != null ? (parseFloat(rule.minCharge) || 0).toFixed(2) : '-'}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground max-w-[100px] truncate">
                  {rule.remark || '-'}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(rule)}
                      className="p-1 rounded-sm hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(rule.id)}
                      className="p-1 rounded-sm hover:bg-accent transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PricingRulesTab;
