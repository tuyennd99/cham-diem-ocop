import { Link } from '@tanstack/react-router';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminProductResults, type AdminProductMode } from '../../queries/admin-products';

export function AdminProductResultsPage({
  productId,
  mode = 'products',
}: {
  productId: string;
  mode?: AdminProductMode;
}) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const { data: product = null, error: loadError } = useAdminProductResults(productId, canManage);
  const error = errorText(loadError);
  if (error)
    return (
      <section>
        <p role='alert' className='form-note'>
          {error}
        </p>
        <Link to={mode === 'products' ? '/admin/products' : '/admin/registrations'}>Quay lại</Link>
      </section>
    );
  if (!product) return <p>Đang tải kết quả…</p>;
  return (
    <section>
      <Link
        className='text-link'
        to={mode === 'products' ? '/admin/products' : '/admin/registrations'}
      >
        ← Tất cả hồ sơ
      </Link>
      <p className='eyebrow'>
        {product.category.groupName} · {product.category.name} · {product.status}
      </p>
      <h1>{product.name}</h1>
      <div className='hero-actions'>
        <Link
          className='button button-secondary'
          to='/print/products/$id/results'
          params={{ id: product.id }}
        >
          In bảng tổng hợp kết quả (A4)
        </Link>
      </div>
      <p>
        <strong>
          {product.status === 'COMPLETED' && product.finalScore !== null
            ? `${formatExactScore(product.finalScore)} điểm · ${formatStarRatingLabel(product.starRating)}`
            : 'Chưa tổng hợp kết quả cuối'}
        </strong>
      </p>
      {product.evaluations.map((evaluation) => (
        <article className='route-panel' key={evaluation.judge.id}>
          <div className='section-heading'>
            <h2>
              {evaluation.judge.fullName} · {evaluation.status}
            </h2>
            {evaluation.id && (
              <Link
                className='button button-secondary'
                to='/print/evaluations/$id'
                params={{ id: evaluation.id }}
              >
                In phiếu chấm
              </Link>
            )}
          </div>
          <p>
            {evaluation.judge.email} · {evaluation.total ?? 'Chưa có tổng điểm'}
          </p>
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
                <strong>{score.option.points} điểm</strong>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
