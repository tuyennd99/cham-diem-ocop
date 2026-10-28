import AlertError from '@/components/alert-error';
import PageSpin from '@/components/page-spin';
import { Button } from '@/components/ui/button';
import {
  BlankCriteriaPrintSheet,
  EvaluationPrintSheet,
  PrintPageToolbar,
  ProductResultsPrintSheet,
  RegistrationPrintSheet,
} from '../../components/print/OcopPrintSheets';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import type { AdminProductSearch } from '../../lib/admin-search';
import { hasStaffPermission } from '../../lib/session-contract';
import {
  useCriteriaSetPrintData,
  useEvaluationPrintData,
  useJudgeEvaluationPrintData,
  useRegistrationPrintData,
  useResultsPrintData,
} from '../../queries/scoring-print';

function PrintLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className='route-panel space-y-2'>
      <AlertError title='Không tải được dữ liệu bản in' errors={[message]} />
      <Button type='button' variant='secondary' onClick={onRetry}>
        Thử lại
      </Button>
    </section>
  );
}

export function BlankCriteriaPrintPreviewPage({
  criteriaSetId,
}: {
  criteriaSetId: string;
}) {
  const { data, error, isPending, refetch } = useCriteriaSetPrintData(criteriaSetId);
  const err = errorText(error);
  return (
    <section className='print-preview-page'>
      <PrintPageToolbar
        backTo='/admin/scoring-forms'
        backLabel='Phiếu chấm OCOP'
        title='Xem trước Mẫu phiếu trắng A4'
      />
      {isPending && <PageSpin />}
      {err && <PrintLoadError message={err} onRetry={() => void refetch()} />}
      {data?.data && <BlankCriteriaPrintSheet data={data.data} />}
    </section>
  );
}

export function AdminEvaluationPrintPreviewPage({
  evaluationId,
}: {
  evaluationId: string;
}) {
  const { data, error, isPending, refetch } = useEvaluationPrintData(evaluationId);
  const err = errorText(error);
  return (
    <section className='print-preview-page'>
      <PrintPageToolbar
        backTo='/admin/scoring-forms'
        backLabel='Danh sách phiếu chấm'
        title='Xem trước Phiếu chấm sản phẩm A4'
      />
      {isPending && <PageSpin />}
      {err && <PrintLoadError message={err} onRetry={() => void refetch()} />}
      {data?.data && <EvaluationPrintSheet data={data.data} />}
    </section>
  );
}

export function JudgeEvaluationPrintPreviewPage({
  productId,
}: {
  productId: string;
}) {
  const { data, error, isPending, refetch } = useJudgeEvaluationPrintData(productId);
  const err = errorText(error);
  return (
    <section className='print-preview-page'>
      <PrintPageToolbar
        backTo={`/judge/products/${encodeURIComponent(productId)}`}
        backLabel='Quay lại màn chấm điểm'
        title='Xem trước Phiếu chấm cá nhân A4'
      />
      {isPending && <PageSpin />}
      {err && <PrintLoadError message={err} onRetry={() => void refetch()} />}
      {data?.data && <EvaluationPrintSheet data={data.data} />}
    </section>
  );
}

export function ProductRegistrationPrintPreviewPage({
  productId,
  search,
}: {
  productId: string;
  search: AdminProductSearch;
}) {
  const session = useSession();
  const isStaffViewer =
    hasStaffPermission(session?.user, 'VIEW') ||
    hasStaffPermission(session?.user, 'MANAGE');
  const mode: 'admin' | 'owner' = isStaffViewer ? 'admin' : 'owner';
  const backTo = isStaffViewer
    ? `/admin/${search.returnMode ?? 'registrations'}/${encodeURIComponent(productId)}`
    : `/my/products/${encodeURIComponent(productId)}`;
  const { returnMode: _returnMode, ...backSearch } = search;

  const { data, error, isPending, refetch } = useRegistrationPrintData(mode, productId);
  const err = errorText(error);
  return (
    <section className='print-preview-page'>
      <PrintPageToolbar
        backTo={backTo}
        backSearch={isStaffViewer ? backSearch : undefined}
        backLabel='Quay lại hồ sơ'
        title='Xem trước Phiếu đăng ký Mẫu số 01 (A4)'
      />
      {isPending && <PageSpin />}
      {err && <PrintLoadError message={err} onRetry={() => void refetch()} />}
      {data?.data && (
        <RegistrationPrintSheet data={data.data} attachmentMode={mode} />
      )}
    </section>
  );
}

export function ProductResultsPrintPreviewPage({
  productId,
  search,
}: {
  productId: string;
  search: AdminProductSearch;
}) {
  const session = useSession();
  const isStaffViewer =
    hasStaffPermission(session?.user, 'VIEW') ||
    hasStaffPermission(session?.user, 'MANAGE');
  const mode: 'admin' | 'owner' = isStaffViewer ? 'admin' : 'owner';
  const backTo = isStaffViewer
    ? `/admin/${search.returnMode ?? 'products'}/${encodeURIComponent(productId)}`
    : `/my/products/${encodeURIComponent(productId)}`;
  const { returnMode: _returnMode, ...backSearch } = search;

  const { data, error, isPending, refetch } = useResultsPrintData(mode, productId);
  const err = errorText(error);
  return (
    <section className='print-preview-page'>
      <PrintPageToolbar
        backTo={backTo}
        backSearch={isStaffViewer ? backSearch : undefined}
        backLabel='Quay lại hồ sơ'
        title='Xem trước Bảng tổng hợp kết quả đánh giá OCOP (A4)'
      />
      {isPending && <PageSpin />}
      {err && <PrintLoadError message={err} onRetry={() => void refetch()} />}
      {data?.data && <ProductResultsPrintSheet data={data.data} />}
    </section>
  );
}
