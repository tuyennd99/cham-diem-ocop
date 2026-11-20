import { PageSection } from '@/layouts/PageLayout';
import { CheckCircle2, UserPlus } from 'lucide-react';
import type { RegistrantProduct } from '@/types/registrant';
import { ALL, EVALUATION_STATUS } from '@/constants/consts';
import { formatDateTime } from '@/lib/admin-date';
import { formatExactScore, formatStarRatingLabel } from '@/lib/print-format';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  formatStatusLabel,
  RESULT_HISTORY_ACTION_LABELS,
  type AdminDetailProduct,
  type EligibleManualJudge,
} from './shared';

export interface ProductProgressTabProps {
  product: AdminDetailProduct | RegistrantProduct;
  adminProduct: AdminDetailProduct | undefined;
  ownerProduct: RegistrantProduct | undefined;
  isOwner: boolean;
  isSubmitted: boolean;
  canView: boolean;
  isScoringOrApproved: boolean;
  busy: boolean;
  addingJudge: boolean;
  restoreConfirmPromptOpen: boolean;
  selectedAddJudgeId: string;
  onSelectedAddJudgeIdChange: (value: string) => void;
  addJudgeReason: string;
  onAddJudgeReasonChange: (value: string) => void;
  eligibleManualJudges: EligibleManualJudge[];
  onAddJudge: () => void;
  onRequestReopenEvaluation: (evaluationId: string, judgeName: string) => void;
  onRequestRemoveAssignment: (judgeId: string, judgeName: string) => void;
}

export function ProductProgressTab({
  product,
  adminProduct,
  ownerProduct,
  isOwner,
  isSubmitted,
  canView,
  isScoringOrApproved,
  busy,
  addingJudge,
  restoreConfirmPromptOpen,
  selectedAddJudgeId,
  onSelectedAddJudgeIdChange,
  addJudgeReason,
  onAddJudgeReasonChange,
  eligibleManualJudges,
  onAddJudge,
  onRequestReopenEvaluation,
  onRequestRemoveAssignment,
}: ProductProgressTabProps) {
  return (
    <div className='space-y-4'>
      {!isOwner && adminProduct && (
        <PageSection>
          <div className='admin-page-heading mb-3'>
            <div>
              <h2>Phân công giám khảo theo cơ quan quản lý</h2>
              <p className='text-muted text-sm'>
                Khi duyệt hồ sơ, hệ thống tự động phân công tất cả giám khảo đang hoạt động thuộc
                các cơ quan quản lý của phân loại sản phẩm. Mỗi giám khảo chấm toàn bộ tiêu chí trên
                phiếu riêng.
              </p>
            </div>
          </div>

          {adminProduct.agencyCoverage && adminProduct.agencyCoverage.length > 0 && (
            <div className='mb-4 grid gap-3 sm:grid-cols-2'>
              {adminProduct.agencyCoverage.map((cov) => (
                <div key={cov.agency.id} className='rounded-lg border p-3 text-sm'>
                  <div className='flex items-center justify-between gap-2'>
                    <strong>
                      {cov.agency.name} ({cov.agency.code})
                    </strong>
                    {cov.hasMissingJudges ? (
                      <Badge variant='destructive'>Thiếu giám khảo</Badge>
                    ) : (
                      <Badge variant='secondary'>
                        <CheckCircle2 className='mr-1 size-3.5' aria-hidden='true' />
                        {cov.activeJudgeCount} giám khảo
                      </Badge>
                    )}
                  </div>
                  <p className='text-muted mt-1 text-xs'>
                    Đã nộp phiếu: {cov.submittedCount} / {cov.activeJudgeCount} giám khảo
                  </p>
                </div>
              ))}
            </div>
          )}

          {canView && isScoringOrApproved && (
            <div className='mb-4 rounded-lg border p-4'>
              <h3 className='mb-2 text-sm font-semibold'>
                Bổ sung thủ công giám khảo thuộc cơ quan tương ứng
              </h3>
              <div className='admin-filters'>
                <FormField
                  label='Chọn giám khảo'
                  htmlFor='product-add-judge-select'
                  className='admin-filter-field'
                  data-filter-width='group'
                >
                  <Combobox
                    value={selectedAddJudgeId || ALL}
                    disabled={busy}
                    onValueChange={(value) =>
                      onSelectedAddJudgeIdChange(value === ALL ? '' : value)
                    }
                  >
                    <ComboboxAnchor>
                      <ComboboxInput
                        id='product-add-judge-select'
                        placeholder='Chọn giám khảo thuộc cơ quan quản lý…'
                      />
                      <ComboboxTrigger />
                    </ComboboxAnchor>
                    <ComboboxContent>
                      <ComboboxEmpty>
                        Không còn giám khảo hợp lệ thuộc cơ quan quản lý này.
                      </ComboboxEmpty>
                      <ComboboxItem value={ALL}>Chọn giám khảo</ComboboxItem>
                      {eligibleManualJudges.map((judge) => (
                        <ComboboxItem key={judge.id} value={judge.id}>
                          {judge.fullName} ({judge.email})
                          {judge.organizationUnit ? ` · ${judge.organizationUnit.name}` : ''}
                        </ComboboxItem>
                      ))}
                    </ComboboxContent>
                  </Combobox>
                </FormField>
                <FormField
                  label='Lý do bổ sung (tùy chọn)'
                  htmlFor='product-add-judge-reason'
                  className='admin-filter-field'
                  data-filter-width='search'
                >
                  <Input
                    id='product-add-judge-reason'
                    value={addJudgeReason}
                    disabled={busy}
                    maxLength={255}
                    placeholder='Ghi chú lý do bổ sung giám khảo…'
                    onChange={(event) => onAddJudgeReasonChange(event.target.value)}
                  />
                </FormField>
                <div className='admin-actions admin-filter-actions'>
                  <Button
                    type='button'
                    loading={addingJudge && !restoreConfirmPromptOpen}
                    disabled={busy || !selectedAddJudgeId}
                    onClick={onAddJudge}
                  >
                    <UserPlus className='size-4' aria-hidden='true' />
                    <span>
                      {addingJudge && !restoreConfirmPromptOpen
                        ? 'Đang bổ sung…'
                        : 'Bổ sung giám khảo'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {adminProduct.judgeAssignments && adminProduct.judgeAssignments.length > 0 ? (
            <div className='record-list'>
              {adminProduct.judgeAssignments.map((assignment) => (
                <div className='record-row' key={assignment.id}>
                  <div className='record-main'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <strong>{assignment.judge.fullName}</strong>
                      <Badge variant={assignment.isActive ? 'secondary' : 'outline'}>
                        {assignment.isActive ? 'Đang phân công' : 'Đã gỡ khỏi hồ sơ'}
                      </Badge>
                      {assignment.isManual && <Badge variant='outline'>Bổ sung thủ công</Badge>}
                      {assignment.mustSubmitToComplete && assignment.isActive && (
                        <Badge variant='outline'>Chờ nộp trước khi hoàn tất</Badge>
                      )}
                      {assignment.evaluation && (
                        <Badge
                          variant='outline'
                          className={
                            assignment.evaluation.status === EVALUATION_STATUS.SUBMITTED
                              ? 'status-badge status-completed'
                              : assignment.evaluation.status === EVALUATION_STATUS.EXCLUDED
                                ? 'status-badge status-draft'
                                : 'status-badge status-scoring'
                          }
                        >
                          {assignment.evaluation.status === EVALUATION_STATUS.SUBMITTED
                            ? `Đã nộp (${assignment.evaluation.total ?? 0} điểm)`
                            : assignment.evaluation.status === EVALUATION_STATUS.EXCLUDED
                              ? 'Phiếu bị loại (lịch sử)'
                              : 'Đang chấm nháp'}
                        </Badge>
                      )}
                    </div>
                    <p className='text-muted mt-1 text-xs'>
                      {assignment.judge.email}
                      {assignment.organizationUnitName
                        ? ` · Đơn vị: ${assignment.organizationUnitName}`
                        : ''}
                      {assignment.managingAgency
                        ? ` · Cơ quan: ${assignment.managingAgency.name}`
                        : ''}
                      {assignment.removeReason ? ` · Lý do gỡ: ${assignment.removeReason}` : ''}
                    </p>
                  </div>
                  <div className='admin-actions'>
                    {canView &&
                      assignment.evaluation?.status === EVALUATION_STATUS.SUBMITTED &&
                      assignment.isActive && (
                        <Button
                          type='button'
                          variant='secondary'
                          size='sm'
                          disabled={busy}
                          onClick={() => {
                            if (!assignment.evaluation) return;
                            onRequestReopenEvaluation(
                              assignment.evaluation.id,
                              assignment.judge.fullName,
                            );
                          }}
                        >
                          Mở lại phiếu
                        </Button>
                      )}
                    {canView && assignment.isActive && (
                      <Button
                        type='button'
                        variant='destructive'
                        size='sm'
                        disabled={busy}
                        onClick={() =>
                          onRequestRemoveAssignment(assignment.judgeId, assignment.judge.fullName)
                        }
                      >
                        Gỡ giám khảo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-muted text-sm'>
              {isSubmitted
                ? 'Hồ sơ đang chờ duyệt. Sau khi duyệt, giám khảo thuộc cơ quan quản lý sẽ được tự động phân công.'
                : 'Chưa có giám khảo nào được phân công cho hồ sơ này.'}
            </p>
          )}
        </PageSection>
      )}

      <PageSection>
        <h2 className='mb-3'>Lịch sử trạng thái hồ sơ</h2>
        {adminProduct ? (
          adminProduct.statusEvents && adminProduct.statusEvents.length > 0 ? (
            <ol className='record-list' style={{ paddingLeft: '20px', margin: 0 }}>
              {adminProduct.statusEvents.map((event) => (
                <li className='border-border border-b py-2 last:border-b-0' key={event.sequence}>
                  <div>
                    <strong>{formatStatusLabel(event.fromStatus)}</strong> →{' '}
                    <strong>{formatStatusLabel(event.toStatus)}</strong>
                  </div>
                  <div className='text-muted mt-0.5 text-xs'>
                    {formatDateTime(event.createdAt)}
                    {event.actor ? ` · Người thực hiện: ${event.actor.fullName}` : ''}
                    {event.reason ? ` · Lý do: ${event.reason}` : ''}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className='text-muted text-sm'>Chưa có sự kiện thay đổi trạng thái nào.</p>
          )
        ) : (
          <dl className='detail-facts'>
            <div>
              <dt>Trạng thái hiện tại</dt>
              <dd>{formatStatusLabel(product.status, true)}</dd>
            </div>
            <div>
              <dt>Thời điểm nộp hồ sơ</dt>
              <dd>{product.submittedAt ? formatDateTime(product.submittedAt) : 'Chưa nộp'}</dd>
            </div>
            <div>
              <dt>Thời điểm hoàn tất đánh giá</dt>
              <dd>
                {ownerProduct?.completedAt
                  ? formatDateTime(ownerProduct.completedAt)
                  : 'Chưa hoàn tất'}
              </dd>
            </div>
            <div>
              <dt>Cập nhật gần nhất</dt>
              <dd>
                {ownerProduct?.updatedAt ? formatDateTime(ownerProduct.updatedAt) : 'Chưa cập nhật'}
              </dd>
            </div>
          </dl>
        )}
      </PageSection>

      {!isOwner && adminProduct?.resultHistory && adminProduct.resultHistory.length > 0 && (
        <PageSection>
          <h2 className='mb-3'>Lịch sử cập nhật &amp; công bố kết quả</h2>
          <ol className='record-list' style={{ paddingLeft: '20px', margin: 0 }}>
            {adminProduct.resultHistory.map((item) => (
              <li className='border-border border-b py-2 last:border-b-0' key={item.id}>
                <div>
                  <strong>{RESULT_HISTORY_ACTION_LABELS[item.action] ?? item.action}</strong>:{' '}
                  {item.finalScore !== null
                    ? `${formatExactScore(item.finalScore)} điểm · ${formatStarRatingLabel(item.starRating)}`
                    : 'Chưa chốt điểm'}
                </div>
                <div className='text-muted mt-0.5 text-xs'>
                  {formatDateTime(item.createdAt)}
                  {item.actor ? ` · bởi ${item.actor.fullName}` : ''}
                  {item.reason ? ` · Ghi chú: ${item.reason}` : ''}
                </div>
              </li>
            ))}
          </ol>
        </PageSection>
      )}
    </div>
  );
}
