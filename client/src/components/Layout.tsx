import { NavLink, Outlet } from 'react-router-dom';
import { Package, Route, History, FlaskConical } from 'lucide-react';
import { useCurrentUserProfile } from '@lark-apaas/client-toolkit/hooks/useCurrentUserProfile';
import { useAppInfo } from '@lark-apaas/client-toolkit/hooks/useAppInfo';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
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
import { Image } from '@client/src/components/ui/image';

const NAV_ITEMS = [
  { path: '/', label: '物流询价工作台', icon: Package },
  { path: '/logistics-routes', label: '物流线路管理', icon: Route },
  { path: '/user-input-history', label: '历史输入记录', icon: History },
  { path: '/batch-test', label: '批量测试', icon: FlaskConical },
];

const DEFAULT_AVATAR =
  'https://lf3-static.bytednsdoc.com/obj/eden-cn/LMfspH/ljhwZthlaukjlkulzlp/miao/no-person.svg';

const Layout = () => {
  const userInfo = useCurrentUserProfile();
  const { appName } = useAppInfo();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = async () => {
    setLogoutOpen(false);
    try {
      const dataloom = await getDataloom();
      const result = await dataloom.service.session.signOut();
      if (result.error) {
        logger.error(`退出登录失败: ${result.error.message}`);
        return;
      }
      window.location.reload();
    } catch (e) {
      logger.error(`退出登录异常: ${e}`);
    }
  };

  const handleLogin = async () => {
    const dataloom = await getDataloom();
    dataloom.service.session.redirectToLogin();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center">
                <Package className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">
                {appName || '物流询价系统'}
              </span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors duration-150 ${
                      isActive
                        ? 'text-primary bg-accent font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent transition-colors duration-150 cursor-pointer">
                <Image
                  src={userInfo?.avatar || DEFAULT_AVATAR}
                  alt="avatar"
                  className="w-7 h-7 rounded-full object-cover"
                />
                <span className="text-sm text-foreground max-w-[100px] truncate hidden sm:block">
                  {userInfo?.name || '游客'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {userInfo?.user_id ? (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userInfo.name}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setLogoutOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    退出登录
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={handleLogin}>
                  登录
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6">
          <Outlet />
        </div>
      </main>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出</AlertDialogTitle>
            <AlertDialogDescription>
              确定要退出登录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Layout;
