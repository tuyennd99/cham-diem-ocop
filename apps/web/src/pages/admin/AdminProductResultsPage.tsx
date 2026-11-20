import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ADMIN_PRODUCT_DETAIL_TAB,
  EVALUATION_STATUS,
  PRODUCT_STATUS,
  PRODUCT_WORKSPACE_MODE,
  STAFF_PERMISSION,
} from '../../constants/consts';
import type { AdminProductSearch } from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import {
  useAdminProductMutations,
  useAdminProductResults,
  type AdminProductMode,
} from '../../queries/admin-products';

const EVALUATION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Đang chấm (nháp)',
  SUBMITTED: 'Đã nộp phiếu chấm',
  EXCLUDED: 'Đã loại khỏi kết quả (đã gỡ giám khảo)',
};

export function AdminProductResultsPage({
  productId,
  mode = PRODUCT_WORKSPACE_MODE.PRODUCTS,
  printSearch,
}: {
  productId: string;
  mode?: AdminProductMode;
  printSearch?: AdminProductSearch;
}) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const canView = hasStaffPermission(session?.user, STAFF_PERMISSION.VIEW);
  const {
    data: product = null,
    error: loadError,
    isPending,
    refetch,
  } = useAdminProductResults(productId, canManage);
  const mutations = useAdminProductMutations(productId, mode, canManage);
  type ProductEvaluationItem = NonNullable<typeof product>['evaluations'][number];
  const [detailEvaluation, setDetailEvaluation] = useState<ProductEvaluationItem | null>(null);
  const [reopenTarget, setReopenTarget] = useState<{
    evaluationId: string;
    judgeName: string;
  } | null>(null);
  const [reopenReason, setReopenReason] = useState(
    'Mở lại phiếu nộp nhầm theo đề nghị của giám khảo',
  );
  const [reopenBusy, setReopenBusy] = useState(false);
  const [reopenError, setReopenError] = useState('');
  const error = errorText(loadError);

  const evaluationPrintSearch = {
    ...printSearch,
    returnProductId: productId,
    tab: ADMIN_PRODUCT_DETAIL_TAB.RESULTS,
  };

  async function confirmReopenEvaluation() {
    if (!reopenTarget || reopenBusy) return;
    setReopenBusy(true);
    setReopenError('');
    try {
      await mutations.reopenEvaluation(reopenTarget.evaluationId, reopenReason.trim() || undefined);
      setReopenTarget(null);
    } catch (cause) {
      setReopenError(errorText(cause) || 'Không thể mở lại phiếu chấm.');
    } finally {
      setReopenBusy(false);
    }
  }

  if (error) {
    return (
      <section className='admin-table-region space-y-2 p-4'>
        <AlertError title='Không thể tải kết quả chấm' errors={[error]} />
        <Button type='button' variant='secondary' size='sm' onClick={() => void refetch()}>
          Thử lại
        </Button>
      </section>
    );
  }

  if (isPending || !product) {
    return <PageSpin />;
  }

  return (
    <section className='admin-page @container'>
      <div className='admin-page-heading'>
        <div>
          <h2>Kết quả chấm</h2>
          <p className='route-intro'>
            {product.status === PRODUCT_STATUS.COMPLETED && product.finalScore !== null
              ? `Tổng điểm cuối: ${formatExactScore(product.finalScore)} điểm · ${formatStarRatingLabel(product.starRating)}`
              : 'Hồ sơ chưa hoàn tất tổng hợp điểm cuối. Điểm từng giám khảo dưới đây là điểm trên phiếu chấm của giám khảo đó.'}
          </p>
        </div>
        <div className='admin-actions'>
          <Button asChild variant='secondary'>
            <Link to='/print/products/$id/results' params={{ id: product.id }} search={printSearch}>
              In bảng tổng hợp kết quả (A4)
            </Link>
          </Button>
        </div>
      </div>

      {product.evaluations.length === 0 ? (
        <div className='admin-table-region p-6'>
          <p className='text-muted text-sm'>Chưa có phiếu chấm nào được ghi nhận cho hồ sơ này.</p>
        </div>
      ) : (
        <div className='admin-table-region divide-border divide-y @2xl:grid @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:gap-x-4 @4xl:grid-cols-[minmax(0,1fr)_auto_auto]'>
          {product.evaluations.map((evaluation) => {
            const hasScores = evaluation.scores.length > 0;
            return (
              <article
                className='grid grid-cols-1 gap-y-3 p-4 @2xl:col-span-full @2xl:grid-cols-subgrid @2xl:items-center'
                key={evaluation.judge.id}
              >
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='mb-0! font-semibold wrap-anywhere'>
                      {evaluation.judge.fullName}
                    </h3>
                    <Badge
                      variant='outline'
                      className={`status-badge max-w-full whitespace-normal! ${
                        evaluation.status === EVALUATION_STATUS.SUBMITTED
                          ? 'status-completed'
                          : evaluation.status === EVALUATION_STATUS.EXCLUDED
                            ? 'status-draft'
                            : 'status-scoring'
                      }`}
                    >
                      {EVALUATION_STATUS_LABEL[evaluation.status] ?? evaluation.status}
                    </Badge>
                  </div>
                  <p className='text-muted mt-1 text-xs wrap-anywhere'>{evaluation.judge.email}</p>
                </div>

                <div className='flex items-baseline justify-between gap-2 @2xl:flex-col @2xl:items-end @2xl:gap-0'>
                  <span className='text-muted text-xs'>Tổng điểm</span>
                  <strong className='text-base' style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {evaluation.total !== null
                      ? `${formatExactScore(evaluation.total)} điểm`
                      : 'Chưa có'}
                  </strong>
                </div>

                <div className='flex flex-wrap items-center gap-2 empty:hidden @2xl:col-span-full @4xl:col-span-1 @4xl:justify-end'>
                  {hasScores && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => setDetailEvaluation(evaluation)}
                    >
                      Chi tiết ({evaluation.scores.length} mục)
                    </Button>
                  )}
                  {canView &&
                    evaluation.id &&
                    evaluation.status === EVALUATION_STATUS.SUBMITTED && (
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => {
                          setReopenError('');
                          setReopenReason('Mở lại phiếu nộp nhầm theo đề nghị của giám khảo');
                          setReopenTarget({
                            evaluationId: evaluation.id!,
                            judgeName: evaluation.judge.fullName,
                          });
                        }}
                      >
                        Mở lại phiếu chấm
                      </Button>
                    )}
                  {evaluation.id && (
                    <Button asChild variant='secondary' size='sm'>
                      <Link
                        to='/print/evaluations/$id'
                        params={{ id: evaluation.id }}
                        search={evaluationPrintSearch}
                      >
                        In phiếu chấm
                      </Link>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={detailEvaluation !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEvaluation(null);
        }}
      >
        <DialogContent className='admin-dialog' data-admin-ui='true' style={{ maxWidth: '720px' }}>
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu chấm: {detailEvaluation?.judge.fullName ?? ''}</DialogTitle>
            <DialogDescription>
              {detailEvaluation
                ? `${detailEvaluation.judge.email} · Tổng điểm: ${
                    detailEvaluation.total !== null
                      ? `${formatExactScore(detailEvaluation.total)} điểm`
                      : 'Chưa có'
                  }`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {detailEvaluation && (
            <div className='record-list max-h-[60vh] overflow-y-auto pr-1'>
              {detailEvaluation.scores.map((score, index) => (
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
          )}
          <DialogFooter>
            {detailEvaluation?.id && (
              <Button asChild variant='secondary'>
                <Link
                  to='/print/evaluations/$id'
                  params={{ id: detailEvaluation.id }}
                  search={evaluationPrintSearch}
                >
                  In phiếu chấm
                </Link>
              </Button>
            )}
            <Button type='button' variant='outline' onClick={() => setDetailEvaluation(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reopenTarget !== null}
        onOpenChange={(open) => {
          if (!open && !reopenBusy) {
            setReopenTarget(null);
            setReopenError('');
          }
        }}
      >
        <DialogContent className='admin-dialog' data-admin-ui='true'>
          <DialogHeader>
            <DialogTitle>Mở lại phiếu chấm: {reopenTarget?.judgeName ?? ''}</DialogTitle>
            <DialogDescription>
              Phiếu chấm sẽ chuyển về trạng thái đang chấm nháp để giám khảo chỉnh sửa và nộp lại.
            </DialogDescription>
          </DialogHeader>
          <div className='admin-form'>
            <FormField label='Lý do mở lại (tùy chọn)' htmlFor='results-reopen-evaluation-reason'>
              <Input
                id='results-reopen-evaluation-reason'
                value={reopenReason}
                maxLength={255}
                disabled={reopenBusy}
                placeholder='Nhập lý do thao tác…'
                onChange={(event) => setReopenReason(event.target.value)}
              />
            </FormField>
            {reopenError && (
              <AlertError title='Không thể mở lại phiếu chấm' errors={[reopenError]} />
            )}
          </div>
          <DialogFooter>
            <Button
              type='button'
              loading={reopenBusy}
              disabled={reopenBusy}
              onClick={() => void confirmReopenEvaluation()}
            >
              {reopenBusy ? 'Đang mở lại…' : 'Xác nhận mở lại phiếu'}
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={reopenBusy}
              onClick={() => {
                setReopenTarget(null);
                setReopenError('');
              }}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
