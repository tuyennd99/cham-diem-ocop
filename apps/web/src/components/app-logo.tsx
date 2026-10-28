import { Award } from 'lucide-react';

export default function AppLogo() {
  return (
    <div className='flex items-center gap-2'>
      <div className='bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md'>
        <Award className='size-4' />
      </div>
      <div className='grid flex-1 text-left text-sm'>
        <span className='mb-0.5 truncate leading-tight font-semibold'>OCOP Đánh Giá</span>
      </div>
    </div>
  );
}
