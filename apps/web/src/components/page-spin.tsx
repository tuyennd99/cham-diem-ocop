import { Spinner } from './ui/spinner';

export default function PageSpin() {
  return (
    <div className='flex h-[40vh] items-center justify-center'>
      <Spinner className='text-primary h-10 w-10' />
    </div>
  );
}
