import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Trash2, Search } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { UserInputHistoryRecord } from '@shared/api.interface';
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

interface HistoryListResponse {
  items: UserInputHistoryRecord[];
  total: number;
}

export default function UserInputHistoryPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<UserInputHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const pageSize = 20;

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axiosForBackend({
        url: '/api/logistics-inquiry/user-history-list',
        method: 'GET',
        params: { page, pageSize },
      });
      const data = response.data as HistoryListResponse;
      setRecords(data.items);
      setTotal(data.total);
    } catch (error) {
      logger.error('获取历史输入记录失败', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllHistory = async () => {
    setClearDialogOpen(false);
    try {
      await axiosForBackend({
        url: '/api/logistics-inquiry/user-history',
        method: 'DELETE',
      });
      setRecords([]);
      setTotal(0);
    } catch (error) {
      logger.error('清空历史记录失败', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold text-foreground">
                历史输入记录
              </h1>
              <span className="text-sm text-muted-foreground">
                共 {total} 条记录
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              清空记录
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Clock className="w-5 h-5 mr-2 animate-spin" />
            加载中...
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Clock className="w-12 h-12 mb-4 opacity-30" />
            <p>暂无历史输入记录</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-[70px] text-xs">时间</TableHead>
                      <TableHead className="text-xs w-[70px]">国家</TableHead>
                      <TableHead className="text-xs min-w-[100px]">产品名称</TableHead>
                      <TableHead className="text-xs w-[80px]">产品种类</TableHead>
                      <TableHead className="text-xs w-[60px]">重量</TableHead>
                      <TableHead className="text-xs w-[45px]">长</TableHead>
                      <TableHead className="text-xs w-[45px]">宽</TableHead>
                      <TableHead className="text-xs w-[45px]">高</TableHead>
                      <TableHead className="text-xs w-[45px]">件数</TableHead>
                      <TableHead className="text-xs w-[70px]">包装</TableHead>
                      <TableHead className="text-xs w-[100px]">邮编</TableHead>
                       <TableHead className="text-xs w-[80px]">申报价值</TableHead>
                       <TableHead className="text-xs min-w-[200px]">选中路线</TableHead>
                       <TableHead className="text-xs w-[80px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} className="hover:bg-accent/50">
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {formatDate(record.lastUsedAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {record.country || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.itemName || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.category || '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.weight ? `${record.weight}kg` : '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.length || '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.width || '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.height || '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.packagingType || '-'}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {record.postalCode || '-'}
                        </TableCell>
                         <TableCell className="text-sm tabular-nums">
                           {record.declaredValue || '-'}
                         </TableCell>
                         <TableCell className="text-sm">
                           {record.selectedRoute ? (
                             <span className="text-primary font-medium">{record.selectedRoute}</span>
                           ) : '-'}
                         </TableCell>
                         <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigate('/', {
                                state: {
                                  country: record.country,
                                  city: record.city,
                                  postalCode: record.postalCode,
                                  weight: record.weight,
                                  length: record.length,
                                  width: record.width,
                                  height: record.height,
                                  quantity: record.quantity,
                                  packagesCount: record.packagesCount,
                                  category: record.category,
                                  packagingType: record.packagingType,
                                  declaredValue: record.declaredValue,
                                  itemName: record.itemName,
                                },
                              });
                            }}
                            className="text-primary hover:text-primary/80 hover:bg-primary/10"
                          >
                            <Search className="w-4 h-4 mr-1" />
                            一键查询
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  第 {page} 页，共 {totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空所有历史输入记录吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
