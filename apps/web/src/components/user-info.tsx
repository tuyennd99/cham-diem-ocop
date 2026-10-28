import type { User } from '@/types';
import { useInitials } from '@/hooks/use-initials';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  VIEWER: 'Cán bộ tra cứu',
  JUDGE: 'Giám khảo',
  REGISTRANT: 'Chủ thể OCOP',
};

export function UserInfo({ user, showEmail = false }: { user: User; showEmail?: boolean }) {
  const getInitials = useInitials();
  const subLabel = showEmail
    ? user.email
    : [user.organizationUnit?.name, ROLE_LABEL[user.role] ?? user.role]
        .filter(Boolean)
        .join(' · ') || user.email;

  return (
    <>
      <Avatar className='h-8 w-8 overflow-hidden rounded-full'>
        <AvatarImage src={undefined} alt={user.fullName} />
        <AvatarFallback className='rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white'>
          {getInitials(user.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className='grid flex-1 text-left text-sm leading-tight'>
        <span className='truncate font-medium'>{user.fullName}</span>
        <span className='text-muted-foreground truncate text-xs'>{subLabel}</span>
      </div>
    </>
  );
}
