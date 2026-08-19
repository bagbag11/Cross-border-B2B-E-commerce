import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, Plus, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Switch } from '@client/src/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { UserDisplay } from '@client/src/components/business-ui/user-display';
import {
  getRouteList,
  toggleRouteStatus,
  syncRoutesToBitable,
} from '@client/src/api/logistics-routes';
import type { LogisticsRouteListItem } from '@shared/api.interface';
import CreateRouteDialog from './CreateRouteDialog';
import RouteDetailSheet from './RouteDetailSheet';

const PAGE_SIZE: number = 20;

const LogisticsRoutesPage = () => {
  const [items, setItems] = useState<LogisticsRouteListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [detailRouteId, setDetailRouteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const isActiveParam: string | undefined =
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'active' ? '启用' : '禁用';
      const result = await getRouteList({
        country: countryFilter || undefined,
        isActive: isActiveParam,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      toast.error('获取线路列表失败');
    } finally {
      setLoading(false);
    }
  }, [countryFilter, statusFilter, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleToggle = async (
    item: LogisticsRouteListItem,
    newStatus: boolean,
  ) => {
    setTogglingId(item.id);
    const newStatusStr: string = newStatus ? '启用' : '禁用';
    try {
      await toggleRouteStatus(item.id, { isActive: newStatusStr });
      setItems((prev: LogisticsRouteListItem[]) =>
        prev.map((r: LogisticsRouteListItem) =>
          r.id === item.id ? { ...r, isActive: newStatusStr } : r,
        ),
      );
      toast.success(newStatus ? '已启用' : '已禁用');
    } catch {
      toast.error('状态切换失败');
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenDetail = (id: string) => {
    setDetailRouteId(id);
    setDetailOpen(true);
  };

  const handleCreated = (id: string) => {
    fetchList();
    setDetailRouteId(id);
    setDetailOpen(true);
  };

  const handleDetailRefresh = () => {
    fetchList();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncRoutesToBitable();
      if (result.errors.length > 0) {
        toast.warning(`同步完成，但有部分失败: 新增${result.added} 更新${result.updated} 失败${result.failed}`);
      } else {
        toast.success(`同步成功: 新增${result.added}条 更新${result.updated}条 共${result.synced}条`);
      }
    } catch {
      toast.error('同步到多维表格失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = (value: string) => {
    setCountryFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const totalPages: number = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索国家/地区"
            value={countryFilter}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="启用状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="active">启用</SelectItem>
            <SelectItem value="inactive">禁用</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '同步到多维表格'}
        </Button>

        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          新建线路
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                  线路名称
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground w-32">
                  货代名称
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                  覆盖国家/地区
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground">
                  覆盖城市
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground w-28">
                  启用状态
                </th>
                <th className="h-10 px-4 text-right font-medium text-muted-foreground w-24">
                  报价规则
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground w-28">
                  更新人
                </th>
                <th className="h-10 px-4 text-left font-medium text-muted-foreground w-36">
                  更新时间
                </th>
                <th className="h-10 px-4 text-center font-medium text-muted-foreground w-16">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="h-24 text-center text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="h-24 text-center text-muted-foreground">
                      暂无数据
                    </td>
                  </tr>
                )}
              {!loading &&
                items.map((item: LogisticsRouteListItem) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 h-12 hover:bg-accent/30 transition-colors ${
                      !item.isActive || item.isActive !== '启用' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-medium text-foreground truncate max-w-[200px]">
                      {item.name}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[140px]">
                      {item.providerName || <span className="text-muted-foreground/60">-</span>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">
                      {item.coverCountries}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[140px]">
                      {item.coverCities || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-200 ${
                            item.isActive === '启用'
                              ? 'bg-[hsl(145_63%_42%)]'
                              : 'bg-gray-400'
                          }`}
                        />
                        <Switch
                          checked={item.isActive === '启用'}
                          onCheckedChange={(checked: boolean) =>
                            handleToggle(item, checked)
                          }
                          disabled={togglingId === item.id}
                          className="scale-75 origin-left"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {item.pricingRuleCount}
                    </td>
                    <td className="px-4 py-2">
                      {item.updatedBy ? (
                        <UserDisplay userId={item.updatedBy} size="small" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs tabular-nums">
                      {new Date(item.updatedAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item.id)}
                        className="p-1.5 rounded-sm hover:bg-accent transition-colors inline-flex items-center"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p: number) => p - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p: number) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateRouteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <RouteDetailSheet
        routeId={detailRouteId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRefresh={handleDetailRefresh}
      />
    </div>
  );
};

export default LogisticsRoutesPage;
