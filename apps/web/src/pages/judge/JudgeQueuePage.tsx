import { PageContainer, PageHeader } from '@/layouts/PageLayout';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Clock, Paperclip, RotateCcw } from 'lucide-react';
import AlertError from '@/components/alert-error';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ADMIN_DASHBOARD_STATUS_LABEL, PRODUCT_STATUS_TONE } from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { useJudgeQueue } from '../../queries/judge';

export function JudgeQueuePage() {
  const {
    data: rows = [],
    error: loadError,
    isPending: loading,
    isFetching,
    refetch,
  } = useJudgeQueue();
  const error = errorText(loadError);
  return (
    <PageContainer>
      <PageHeader
        title='Hàng chờ chấm'
        description='Danh sách hồ sơ sản phẩm được phân công chấm điểm cho hội đồng.'
        actions={
          <Button
            type='button'
            variant='secondary'
            loading={isFetching}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RotateCcw className='size-4' aria-hidden='true' />
            <span>{isFetching ? 'Đang tải…' : 'Tải lại'}</span>
          </Button>
        }
      />
      {loading && <PageSpin />}
      {error && (
        <div className='space-y-2'>
          <AlertError title='Không thể tải hàng chờ chấm' errors={[error]} />
          <Button type='button' variant='secondary' size='sm' onClick={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {!loading && !error && !rows.length && (
        <div className='empty-state'>
          <h2>Chưa có hồ sơ được phân công</h2>
          <p>Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.</p>
        </div>
      )}
      {!loading && !error && (
        <div className='record-list'>
          {rows.map((row) => {
            const evaluation = row.evaluations[0];
            const isSubmitted = evaluation?.status === 'SUBMITTED';
            return (
              <article
                className={`record-row workspace-record-row judge-queue-card ${
                  isSubmitted ? 'is-eval-submitted' : 'is-eval-open'
                }`}
                key={row.id}
              >
                <div className='record-main judge-queue-main'>
                  <div className='record-badges'>
                    <Badge variant='secondary'>{row.category.name}</Badge>
                    <Badge variant='outline' className={PRODUCT_STATUS_TONE[row.status]}>
                      {ADMIN_DASHBOARD_STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  <div className='judge-queue-content'>
                    <h2>{row.name}</h2>
                    {row.description && (
                      <p className='judge-queue-description'>{row.description}</p>
                    )}
                  </div>
                  <div className='judge-queue-footer'>
                    {isSubmitted ? (
                      <span className='judge-eval-status-pill is-submitted'>
                        <CheckCircle2 className='size-3.5 shrink-0' aria-hidden='true' />
                        <span>
                          Đã nộp phiếu · <strong>{evaluation.total ?? 0} điểm</strong>
                        </span>
                      </span>
                    ) : (
                      <span className='judge-eval-status-pill is-open'>
                        <Clock className='size-3.5 shrink-0' aria-hidden='true' />
                        <span>Phiếu chấm đang mở</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className='record-result judge-queue-aside'>
                  <span className='judge-attachment-pill'>
                    <Paperclip className='size-3.5 shrink-0' aria-hidden='true' />
                    <span>{row.attachments.length} tệp đính kèm</span>
                  </span>
                  <Button asChild variant={isSubmitted ? 'secondary' : 'default'}>
                    <Link
                      to='/judge/products/$id'
                      params={{ id: row.id }}
                      aria-label={`${isSubmitted ? 'Xem phiếu đã nộp' : 'Chấm điểm'} ${row.name}`}
                    >
                      {isSubmitted ? 'Xem phiếu đã nộp' : 'Chấm điểm'}
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
