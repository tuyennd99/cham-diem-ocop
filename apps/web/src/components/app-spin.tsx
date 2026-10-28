import { Spinner } from './ui/spinner';

export default function AppSpin() {
  return (
    <div className='flex h-screen w-screen items-center justify-center'>
      <Spinner className='text-primary h-10 w-10' />
    </div>
  );
}
