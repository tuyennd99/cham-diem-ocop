import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import PageSpin from '@/components/page-spin';
import { Button } from '@/components/ui/button';
import type { AdminProductSearch } from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminProductResults, type AdminProductMode } from '../../queries/admin-products';

const EVALUATION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Đang chấm (nháp)',
  SUBMITTED: 'Đã nộp phiếu chấm',
};

export function AdminProductResultsPage({
  productId,
  mode: _mode = 'products',
  printSearch,
}: {
  productId: string;
  mode?: AdminProductMode;
  printSearch?: AdminProductSearch;
}) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const {
    data: product = null,
    error: loadError,
    isPending,
    refetch,
  } = useAdminProductResults(productId, canManage);
  const error = errorText(loadError);

  if (error) {
    return (
      <section className='admin-table-region p-4 space-y-2'>
        <AlertError title='Không thể tải kết quả chấm' errors={[error]} />
        <Button
          type='button'
          variant='secondary'
          size='sm'
          onClick={() => void refetch()}
        >
          Thử lại
        </Button>
      </section>
    );
  }

  if (isPending || !product) {
    return <PageSpin />;
  }

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h2>Kết quả chấm</h2>
          <p className='route-intro'>
            {product.status === 'COMPLETED' && product.finalScore !== null
              ? `Tổng điểm cuối: ${formatExactScore(product.finalScore)} điểm · ${formatStarRatingLabel(product.starRating)}`
              : 'Hồ sơ chưa hoàn tất tổng hợp điểm cuối. Điểm từng giám khảo dưới đây là điểm trong phạm vi được phân công.'}
          </p>
        </div>
        <div className='admin-actions'>
          <Button asChild variant='secondary'>
            <Link
              to='/print/products/$id/results'
              params={{ id: product.id }}
              search={printSearch}
            >
              In bảng tổng hợp kết quả (A4)
            </Link>
          </Button>
        </div>
      </div>

      {product.evaluations.length === 0 ? (
        <div className='admin-table-region p-6'>
          <p className='text-sm text-muted'>
            Chưa có phiếu chấm nào được ghi nhận cho hồ sơ này.
          </p>
        </div>
      ) : (
        product.evaluations.map((evaluation) => (
          <article className='admin-table-region p-5' key={evaluation.judge.id}>
            <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
              <div>
                <h3>
                  {evaluation.judge.fullName} ·{' '}
                  {EVALUATION_STATUS_LABEL[evaluation.status] ?? evaluation.status}
                </h3>
                <p className='text-sm text-muted'>
                  {evaluation.judge.email} · Điểm trong phạm vi:{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {evaluation.total !== null ? `${formatExactScore(evaluation.total)} điểm` : 'Chưa có tổng điểm'}
                  </strong>
                </p>
              </div>
              {evaluation.id && (
                <Button asChild variant='secondary' size='sm'>
                  <Link
                    to='/print/evaluations/$id'
                    params={{ id: evaluation.id }}
                  >
                    In phiếu chấm
                  </Link>
                </Button>
              )}
            </div>
            <div className='record-list'>
              {evaluation.scores.map((score, index) => (
                <div className='record-row' key={`${score.subCriterion.code}-${index}`}>
                  <div className='record-main'>
                    <strong>
                      {score.subCriterion.criterion.code} · {score.subCriterion.criterion.name}
                    </strong>
                    <p>
                      {score.subCriterion.code} · {score.option.label}
                    </p>
                    {score.note && <p>{score.note}</p>}
                  </div>
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {score.option.points} điểm
                  </strong>
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
