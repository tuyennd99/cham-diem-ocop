import { cn } from '@/lib/utils';
import { useResizableColumns } from '@/hooks/use-resizable-columns';

export { useResizableColumns } from '@/hooks/use-resizable-columns';
export type {
  ColumnBounds,
  ResizableColumnSide,
  ResizableColumnWidths,
  UseResizableColumnsOptions,
} from '@/hooks/use-resizable-columns';

export function ColumnResizeHandle({
  className,
  ...props
}: ReturnType<ReturnType<typeof useResizableColumns>['getHandleProps']> & {
  className?: string;
}) {
  return <div className={cn('column-resize-handle', className)} {...props} />;
}
