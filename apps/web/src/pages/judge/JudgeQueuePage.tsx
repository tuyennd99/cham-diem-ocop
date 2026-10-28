import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorText } from '../../lib/api-error';
import { useJudgeQueue } from '../../queries/judge';

export function JudgeQueuePage() {
  const { data: rows = [], error: loadError, isPending: loading } = useJudgeQueue();
  const error = errorText(loadError);
  return (
    <section>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>KHU VỰC GIÁM KHẢO</p>
          <h1>Hàng chờ chấm</h1>
        </div>
      </div>
      {loading && <PageSpin />}
      {error && <AlertError title='Không thể tải hàng chờ chấm' errors={[error]} />}
      {!loading && !error && !rows.length && (
        <div className='empty-state'>
          <h2>Chưa có hồ sơ được phân công</h2>
          <p>Các hồ sơ sẽ xuất hiện tại đây khi được nộp và phân công.</p>
        </div>
      )}
      {!loading && !error && (
        <div className='record-list'>
          {rows.map((row) => (
            <article className='record-row' key={row.id}>
              <div className='record-main'>
                <div className='record-badges'>
                  <Badge variant='secondary'>{row.category.name}</Badge>
                  <Badge variant='outline'>{row.status}</Badge>
                </div>
                <h2>{row.name}</h2>
                <p>{row.description}</p>
                <p>
                  {row.evaluations[0]?.status === 'SUBMITTED'
                    ? `Đã nộp phiếu · ${row.evaluations[0].total ?? 0} điểm`
                    : 'Phiếu chấm đang mở'}
                </p>
              </div>
              <div className='record-result'>
                <span>{row.attachments.length} ảnh</span>
                <Button asChild variant='secondary'>
                  <Link to='/judge/products/$id' params={{ id: row.id }}>
                    Mở phiếu
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
