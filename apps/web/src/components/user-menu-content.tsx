import { Link, useNavigate } from '@/components/navigation';
import { setSession } from '@/lib/auth';
import { useAppStore } from '@/stores/app-store';
import type { User } from '@/types';
import { Globe, KeyRound, LogOut, Settings } from 'lucide-react';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';

type Props = {
  user: User;
};

export function UserMenuContent({ user }: Props) {
  const cleanup = useMobileNavigation();
  const navigate = useNavigate();
  const logoutStore = useAppStore((state) => state.logout);

  const handleLogout = () => {
    logoutStore();
    setSession(null);
    cleanup();
    void navigate('/login', { replace: true });
  };

  return (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
          <UserInfo user={user} showEmail={true} />
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to='/account' onClick={cleanup} className='cursor-pointer'>
          <Settings className='mr-2 size-4' />
          Tài khoản
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to='/account/password' onClick={cleanup} className='cursor-pointer'>
          <KeyRound className='mr-2 size-4' />
          Đổi mật khẩu
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to='/' onClick={cleanup} className='cursor-pointer'>
          <Globe className='mr-2 size-4' />
          Trang công khai
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <button
          onClick={handleLogout}
          data-test='logout-button'
          type='button'
          className='flex w-full cursor-pointer items-center'
        >
          <LogOut className='mr-2 size-4' />
          Đăng xuất
        </button>
      </DropdownMenuItem>
    </>
  );
}
