import { useState } from 'react';
import type { ReactNode } from 'react';
import type {
  BlankCriteriaPrintData,
  EvaluationPrintData,
  ProductResultsPrintData,
  RegistrationPrintData,
} from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { formatFormValue } from '../../lib/utils';
import { PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';

function formatViDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
}

export function PrintPageToolbar({
  backTo,
  backLabel = '← Quay lại',
  title,
  children,
}: {
  backTo: string;
  backLabel?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className='print-toolbar no-print' role='region' aria-label='Thanh công cụ in A4'>
      <div className='hero-actions'>
        <Link className='button button-secondary' to={backTo}>
          {backLabel}
        </Link>
        <strong>{title}</strong>
      </div>
      <div className='hero-actions'>
        {children}
        <Button type='button' onClick={() => window.print()}>
          In / Lưu PDF (A4)
        </Button>
      </div>
    </div>
  );
}

export function BlankCriteriaPrintSheet({ data }: { data: BlankCriteriaPrintData }) {
  const { criteriaSet } = data;
  return (
    <article className='ocop-print-sheet' aria-label='Mẫu phiếu trắng đánh giá OCOP'>
      <header className='print-sheet-header'>
        <div className='print-watermark'>MẪU PHIẾU TRẮNG</div>
        <p className='print-gov-header'>
          CHƯƠNG TRÌNH MỖI XÃ MỘT SẢN PHẨM (OCOP) — QUYẾT ĐỊNH SỐ 26/2026/QĐ-TTg
        </p>
        <h1>PHIẾU ĐÁNH GIÁ, CHẤM ĐIỂM SẢN PHẨM OCOP (MẪU TRẮNG)</h1>
        <dl className='print-meta-grid'>
          <div>
            <dt>Nhóm sản phẩm:</dt>
            <dd>
              {criteriaSet.groupCode} · {criteriaSet.groupName}
            </dd>
          </div>
          <div>
            <dt>Phân loại sản phẩm:</dt>
            <dd>
              {criteriaSet.categoryName} ({criteriaSet.classificationGroup}
              {criteriaSet.classificationSubgroup
                ? ` / ${criteriaSet.classificationSubgroup}`
                : ''}
              )
            </dd>
          </div>
          <div>
            <dt>Tên bộ tiêu chí:</dt>
            <dd>{criteriaSet.name ?? criteriaSet.categoryName}</dd>
          </div>
          <div>
            <dt>Nguồn văn bản &amp; Phiên bản:</dt>
            <dd>
              {criteriaSet.source ?? 'Quyết định 26/2026/QĐ-TTg'} · Phiên bản v
              {criteriaSet.version} · Mã bộ: <code>{criteriaSet.id}</code>
            </dd>
          </div>
          <div>
            <dt>Số tiêu chí / Tổng điểm tối đa:</dt>
            <dd>
              {criteriaSet.criterionCount} tiêu chí · Tối đa {criteriaSet.maxScore} điểm
            </dd>
          </div>
          <div>
            <dt>Tên sản phẩm đánh giá:</dt>
            <dd>........................................................................</dd>
          </div>
          <div>
            <dt>Chủ thể đăng ký:</dt>
            <dd>........................................................................</dd>
          </div>
          <div>
            <dt>Họ tên thành viên Hội đồng / Đơn vị:</dt>
            <dd>........................................................................</dd>
          </div>
        </dl>
      </header>

      <table className='print-table'>
        <thead>
          <tr>
            <th scope='col' style={{ width: '9%' }}>
              Mã
            </th>
            <th scope='col' style={{ width: '48%' }}>
              Nội dung tiêu chí / Tiểu tiêu chí &amp; Các mức điểm
            </th>
            <th scope='col' style={{ width: '11%' }}>
              Điểm tối đa
            </th>
            <th scope='col' style={{ width: '12%' }}>
              Điểm chấm
            </th>
            <th scope='col' style={{ width: '20%' }}>
              Ghi chú / Nhận xét
            </th>
          </tr>
        </thead>
        <tbody>
          {criteriaSet.criteria.map((criterion) => (
            <tr className='print-criterion-group' key={criterion.id}>
              <td>
                <strong>{criterion.code}</strong>
                <br />
                <small>Phần {criterion.sectionCode}</small>
              </td>
              <td>
                <div className='print-criterion-title'>
                  <strong>
                    Phần {criterion.sectionCode} ({criterion.sectionName}) — {criterion.name}
                  </strong>
                </div>
                {criterion.subCriteria.map((sub) => (
                  <div className='print-subcriterion-block' key={sub.id}>
                    <p className='print-subcriterion-heading'>
                      <strong>{sub.code}:</strong> {sub.content}
                    </p>
                    <ul className='print-option-list'>
                      {sub.options.map((opt) => (
                        <li key={opt.id}>
                          ☐ {opt.label} (<strong>{opt.points} điểm</strong>)
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </td>
              <td className='print-num'>{criterion.maxScore}</td>
              <td className='print-num'>..........</td>
              <td></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope='row' colSpan={2}>
              TỔNG CỘNG TOÀN BỘ TIÊU CHÍ
            </th>
            <th className='print-num'>{criteriaSet.maxScore}</th>
            <th className='print-num'>..........</th>
            <th></th>
          </tr>
        </tfoot>
      </table>

      <footer className='print-signatures'>
        <div>
          <strong>THƯ KÝ HỘI ĐỒNG</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <strong>THÀNH VIÊN HỘI ĐỒNG CHẤM</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
      </footer>
      <p className='print-footnote'>
        Thời điểm kết xuất mẫu trắng: {formatViDateTime(data.generatedAt)}
      </p>
    </article>
  );
}

export function EvaluationPrintSheet({ data }: { data: EvaluationPrintData }) {
  return (
    <article className='ocop-print-sheet' aria-label='Phiếu chấm điểm sản phẩm OCOP'>
      <header className='print-sheet-header'>
        {data.isDraft && <div className='print-watermark'>BẢN NHÁP — CHƯA NỘP</div>}
        <p className='print-gov-header'>
          CHƯƠNG TRÌNH MỖI XÃ MỘT SẢN PHẨM (OCOP) — PHIẾU CHẤM ĐIỂM CÁ NHÂN
        </p>
        <h1>PHIẾU CHẤM ĐIỂM SẢN PHẨM OCOP</h1>
        {data.isDraft && (
          <p className='print-warning-banner' role='status'>
            BẢN NHÁP — CHƯA NỘP: Phiếu chấm này đang lưu nháp, chưa có giá trị tổng hợp kết quả
            chính thức.
          </p>
        )}
        {!data.isDraft && !data.historicalValuesVerified && (
          <p className='print-warning-banner' role='status'>
            Lưu ý chất lượng dữ liệu: Phiếu nộp trước thời điểm nâng cấp hệ thống (PRE_UPGRADE),
            một số thông tin đơn vị/thời điểm lịch sử không được ghi nhận đầy đủ.
          </p>
        )}
        <dl className='print-meta-grid'>
          <div>
            <dt>Sản phẩm:</dt>
            <dd>
              <strong>{data.product.name}</strong> (Mã hồ sơ: <code>{data.product.id}</code>)
            </dd>
          </div>
          <div>
            <dt>Chủ thể đăng ký:</dt>
            <dd>{data.product.entityName ?? 'Chưa khai báo tên chủ thể'}</dd>
          </div>
          <div>
            <dt>Nhóm / Phân loại:</dt>
            <dd>
              {data.product.groupName} · {data.product.categoryName}
            </dd>
          </div>
          <div>
            <dt>Người chấm / Đơn vị:</dt>
            <dd>
              <strong>{data.judge.fullName}</strong> ·{' '}
              {data.judge.organizationUnitName ?? 'Chưa gán đơn vị'}
            </dd>
          </div>
          <div>
            <dt>Bộ tiêu chí áp dụng:</dt>
            <dd>
              {data.criteriaSet.name ?? data.product.categoryName} (
              {data.criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'}
              {data.criteriaSet.version ? ` · v${data.criteriaSet.version}` : ''})
            </dd>
          </div>
          <div>
            <dt>Phạm vi phân công &amp; Trạng thái:</dt>
            <dd>
              {data.isPartialScope
                ? `Phân công một phần (Tối đa ${data.scopeMaxScore} điểm)`
                : `Toàn bộ bộ tiêu chí (Tối đa ${data.scopeMaxScore} điểm)`}{' '}
              · {data.isDraft ? 'BẢN NHÁP — CHƯA NỘP' : `Đã nộp (${formatViDateTime(data.submittedAt)})`}
            </dd>
          </div>
        </dl>
      </header>

      <table className='print-table'>
        <thead>
          <tr>
            <th scope='col' style={{ width: '9%' }}>
              Mã
            </th>
            <th scope='col' style={{ width: '44%' }}>
              Tiêu chí / Tiểu tiêu chí &amp; Mức lựa chọn
            </th>
            <th scope='col' style={{ width: '11%' }}>
              Tối đa
            </th>
            <th scope='col' style={{ width: '12%' }}>
              Điểm BE
            </th>
            <th scope='col' style={{ width: '24%' }}>
              Nhận xét / Ghi chú
            </th>
          </tr>
        </thead>
        <tbody>
          {data.criteria.map((criterion) => {
            const criterionEarned = criterion.inScope
              ? criterion.subCriteria.reduce((sum, s) => sum + (s.points ?? 0), 0)
              : null;
            return (
              <tr
                className={`print-criterion-group${criterion.inScope ? '' : ' is-out-of-scope'}`}
                key={criterion.criterionId}
              >
                <td>
                  <strong>{criterion.code}</strong>
                  <br />
                  <small>Phần {criterion.sectionCode}</small>
                </td>
                <td>
                  <div className='print-criterion-title'>
                    <strong>
                      Phần {criterion.sectionCode} ({criterion.sectionName}) — {criterion.name}
                    </strong>
                  </div>
                  {!criterion.inScope ? (
                    <p className='out-of-scope-label'>
                      Ngoài phạm vi phân công (không tính 0 điểm vào tiêu chí này)
                    </p>
                  ) : (
                    criterion.subCriteria.map((sub) => (
                      <div className='print-subcriterion-block' key={sub.subCriterionId}>
                        <p className='print-subcriterion-heading'>
                          <strong>{sub.code}:</strong> {sub.content}
                        </p>
                        <p className='print-selected-option'>
                          Lựa chọn:{' '}
                          <strong>
                            {sub.selectedLabel ?? 'Chưa chọn mức điểm'}
                          </strong>{' '}
                          ({sub.points !== null ? `${sub.points} điểm` : '—'})
                        </p>
                      </div>
                    ))
                  )}
                </td>
                <td className='print-num'>{criterion.maxScore}</td>
                <td className='print-num'>
                  {criterion.inScope ? `${criterionEarned ?? 0}` : 'Ngoài phạm vi'}
                </td>
                <td>
                  {criterion.inScope
                    ? criterion.subCriteria
                        .filter((s) => Boolean(s.note))
                        .map((s) => `${s.code}: ${s.note}`)
                        .join('; ') || '—'
                    : 'Ngoài phạm vi phân công'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope='row' colSpan={2}>
              {data.isPartialScope
                ? 'TỔNG ĐIỂM TRONG PHẠM VI PHÂN CÔNG (Không quy đổi thành sao cuối cùng)'
                : 'TỔNG ĐIỂM PHIẾU CHẤM'}
            </th>
            <th className='print-num'>{data.scopeMaxScore}</th>
            <th className='print-num'>{formatExactScore(data.total)}</th>
            <th>
              {data.isPartialScope
                ? 'Phiếu chấm một phần phạm vi'
                : data.isDraft
                  ? 'BẢN NHÁP — CHƯA NỘP'
                  : 'Đã khóa phiếu'}
            </th>
          </tr>
        </tfoot>
      </table>

      <footer className='print-signatures'>
        <div>
          <strong>TỔ THƯ KÝ</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <strong>NGƯỜI CHẤM ĐIỂM</strong>
          <p>{data.judge.fullName}</p>
        </div>
      </footer>
      <p className='print-footnote'>
        Mã phiếu: {data.evaluationId ?? 'Nháp'} · Thời điểm kết xuất: {formatViDateTime(data.generatedAt)}
      </p>
    </article>
  );
}

export function ProductResultsPrintSheet({ data }: { data: ProductResultsPrintData }) {
  const { product, criteriaSet, evaluations, criteriaSummary } = data;
  const isCompleted = product.status === 'COMPLETED';
  return (
    <article className='ocop-print-sheet' aria-label='Bảng tổng hợp kết quả đánh giá OCOP'>
      <header className='print-sheet-header'>
        {!isCompleted && <div className='print-watermark'>TIẾN ĐỘ CHẤM — CHƯA HOÀN TẤT</div>}
        <p className='print-gov-header'>
          CHƯƠNG TRÌNH MỖI XÃ MỘT SẢN PHẨM (OCOP) — BẢNG TỔNG HỢP KẾT QUẢ CHẤM ĐIỂM
        </p>
        <h1>BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ SẢN PHẨM OCOP</h1>
        {!isCompleted && (
          <p className='print-warning-banner' role='status'>
            Hồ sơ chưa hoàn tất chấm điểm ({product.status}) — Bản in này chỉ phản ánh tiến độ các
            phiếu hiện có, chưa có điểm cuối cùng hoặc mức sao.
          </p>
        )}
        <dl className='print-meta-grid'>
          <div>
            <dt>Tên sản phẩm:</dt>
            <dd>
              <strong>{product.name}</strong> (Mã hồ sơ: <code>{product.id}</code>)
            </dd>
          </div>
          <div>
            <dt>Chủ thể đăng ký:</dt>
            <dd>{product.entityName ?? 'Chưa khai báo'}</dd>
          </div>
          <div>
            <dt>Nhóm / Phân loại:</dt>
            <dd>
              {product.groupName} · {product.categoryName}
            </dd>
          </div>
          <div>
            <dt>Địa bàn:</dt>
            <dd>
              {product.localityName
                ? `${product.localityName} · ${product.provinceName ?? ''}`
                : 'Chưa xác định địa bàn'}
            </dd>
          </div>
          <div>
            <dt>Bộ tiêu chí áp dụng:</dt>
            <dd>
              {criteriaSet
                ? `${criteriaSet.name ?? product.categoryName} (${criteriaSet.source ?? 'QĐ 26/2026/QĐ-TTg'} · v${criteriaSet.version})`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Ngày nộp / Ngày hoàn tất:</dt>
            <dd>
              Nộp: {formatViDateTime(product.submittedAt)} · Hoàn tất:{' '}
              {formatViDateTime(product.completedAt)}
            </dd>
          </div>
          <div>
            <dt>Điểm tổng hợp cuối cùng (BE):</dt>
            <dd>
              <strong>
                {isCompleted ? `${formatExactScore(product.finalScore)} / 100 điểm` : 'Chưa hoàn tất'}
              </strong>
            </dd>
          </div>
          <div>
            <dt>Mức sao tính từ điểm hệ thống:</dt>
            <dd>
              <strong>
                {isCompleted
                  ? (product.starLabel ?? formatStarRatingLabel(product.starRating))
                  : 'Chưa xếp sao'}
              </strong>
            </dd>
          </div>
        </dl>
        {isCompleted && product.starRating === 5 && (
          <p className='print-disclaimer-box'>
            <strong>Ghi chú pháp lý:</strong> Kết quả từ 90 đến 100 điểm được hệ thống ghi nhận là{' '}
            <strong>mức điểm 5 sao / đề nghị xem xét 5 sao</strong> theo điểm chấm, không thay thế
            Quyết định công nhận sản phẩm OCOP cấp quốc gia của cơ quan có thẩm quyền.
          </p>
        )}
      </header>

      <h2>1. Danh sách phiếu chấm của các thành viên Hội đồng</h2>
      <table className='print-table'>
        <thead>
          <tr>
            <th scope='col'>Thành viên chấm</th>
            <th scope='col'>Đơn vị công tác (tại thời điểm nộp)</th>
            <th scope='col'>Phạm vi phân công</th>
            <th scope='col'>Trạng thái</th>
            <th scope='col'>Thời điểm nộp</th>
            <th scope='col'>Tổng điểm trong phạm vi</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.length === 0 ? (
            <tr>
              <td colSpan={6}>Chưa có phiếu chấm nào được nộp.</td>
            </tr>
          ) : (
            evaluations.map((ev) => (
              <tr key={ev.id}>
                <td>
                  <strong>{ev.judgeName}</strong>
                </td>
                <td>{ev.organizationUnitName ?? 'Chưa gán đơn vị'}</td>
                <td>
                  {ev.isPartialScope
                    ? `Phân công một phần (Tối đa ${ev.scopeMaxScore} điểm)`
                    : `Toàn bộ tiêu chí (Tối đa ${ev.scopeMaxScore} điểm)`}
                </td>
                <td>{ev.status === 'SUBMITTED' ? 'Đã nộp' : 'BẢN NHÁP — CHƯA NỘP'}</td>
                <td>{formatViDateTime(ev.submittedAt)}</td>
                <td className='print-num'>
                  {ev.total !== null ? `${formatExactScore(ev.total)} / ${ev.scopeMaxScore}` : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2>2. Tổng hợp điểm trung bình theo từng tiêu chí</h2>
      <table className='print-table'>
        <thead>
          <tr>
            <th scope='col' style={{ width: '14%' }}>
              Mã tiêu chí
            </th>
            <th scope='col' style={{ width: '54%' }}>
              Tên tiêu chí
            </th>
            <th scope='col' style={{ width: '16%' }}>
              Điểm tối đa
            </th>
            <th scope='col' style={{ width: '16%' }}>
              Điểm trung bình
            </th>
          </tr>
        </thead>
        <tbody>
          {criteriaSummary.map((row) => (
            <tr key={row.criterionId}>
              <td>
                <strong>{row.code}</strong>
              </td>
              <td>{row.name}</td>
              <td className='print-num'>{row.maxScore}</td>
              <td className='print-num'>{formatExactScore(row.averageScore)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope='row' colSpan={2}>
              ĐIỂM TỔNG HỢP CUỐI CÙNG &amp; MỨC SAO THEO ĐIỂM
            </th>
            <th className='print-num'>100</th>
            <th className='print-num'>
              {isCompleted
                ? `${formatExactScore(product.finalScore)} điểm (${product.starLabel ?? formatStarRatingLabel(product.starRating)})`
                : 'Chưa hoàn tất'}
            </th>
          </tr>
        </tfoot>
      </table>

      <footer className='print-signatures'>
        <div>
          <strong>TỔ THƯ KÝ HỘI ĐỒNG</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <strong>CHỦ TỊCH HỘI ĐỒNG ĐÁNH GIÁ OCOP</strong>
          <p>(Ký, đóng dấu, ghi rõ họ tên)</p>
        </div>
      </footer>
      <p className='print-footnote'>
        Thời điểm kết xuất bảng tổng hợp: {formatViDateTime(data.generatedAt)}
      </p>
    </article>
  );
}

export function RegistrationPrintSheet({
  data,
  attachmentMode,
}: {
  data: RegistrationPrintData;
  attachmentMode: 'admin' | 'owner';
}) {
  const imageAttachments = data.attachments.filter((att) => att.type === 'IMAGE');
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(() =>
    imageAttachments.slice(0, 2).map((att) => att.id),
  );

  function toggleImage(id: string) {
    setSelectedImageIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const { formData } = data;

  return (
    <article className='ocop-print-sheet' aria-label='Phiếu đăng ký sản phẩm OCOP Mẫu số 01'>
      {imageAttachments.length > 0 && (
        <aside className='no-print route-panel' aria-label='Chọn ảnh sản phẩm đưa vào bản in'>
          <strong>Chọn ảnh minh họa sản phẩm in kèm Mẫu số 01:</strong>
          <div className='hero-actions'>
            {imageAttachments.map((img) => (
              <label key={img.id}>
                <input
                  type='checkbox'
                  checked={selectedImageIds.includes(img.id)}
                  onChange={() => toggleImage(img.id)}
                />{' '}
                {img.fileName}
              </label>
            ))}
          </div>
        </aside>
      )}

      <header className='print-sheet-header'>
        {data.isDraft && <div className='print-watermark'>BẢN NHÁP</div>}
        <p className='print-gov-header'>
          MẪU SỐ 01 — PHỤ LỤC III (Kèm theo Quyết định số 26/2026/QĐ-TTg ngày 22/05/2026)
        </p>
        <h1>PHIẾU ĐĂNG KÝ ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP</h1>
        {data.isDraft && (
          <p className='print-warning-banner' role='status'>
            BẢN NHÁP: Hồ sơ đăng ký chưa được nộp chính thức.
          </p>
        )}
        {!data.isDraft && !data.hasSubmissionSnapshot && (
          <p className='print-warning-banner' role='status'>
            Hồ sơ nộp trước khi bổ sung lưu trữ snapshot đăng ký; hiển thị theo dữ liệu đã ghi nhận
            trên hồ sơ.
          </p>
        )}
      </header>

      <h2>I. THÔNG TIN CHỦ THỂ SẢN XUẤT</h2>
      <table className='print-table'>
        <tbody>
          <tr>
            <th scope='row' style={{ width: '32%' }}>
              Tên chủ thể sản xuất
            </th>
            <td>{formatFormValue(formData.entityName, 'entityName')}</td>
          </tr>
          <tr>
            <th scope='row'>Người đại diện / Chức danh</th>
            <td>
              {formatFormValue(formData.representativeName, 'representativeName')} —{' '}
              {formatFormValue(formData.representativeTitle, 'representativeTitle')}
            </td>
          </tr>
          <tr>
            <th scope='row'>Địa chỉ liên hệ</th>
            <td>
              {formatFormValue(formData.contactAddress, 'contactAddress')} ·{' '}
              {formatFormValue(formData.provinceName, 'provinceName')}
            </td>
          </tr>
          <tr>
            <th scope='row'>Địa bàn thống kê (Xã / Phường)</th>
            <td>
              {data.locality
                ? `${data.locality.name} (${data.locality.code}) · ${data.locality.provinceName}`
                : 'Chưa xác định địa bàn'}
            </td>
          </tr>
          <tr>
            <th scope='row'>Điện thoại / Email</th>
            <td>
              Điện thoại: {formData.phone || data.registrant.phone || '—'} · Email:{' '}
              {formData.email || data.registrant.email}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>II. THÔNG TIN SẢN PHẨM ĐĂNG KÝ</h2>
      <table className='print-table'>
        <tbody>
          <tr>
            <th scope='row' style={{ width: '32%' }}>
              Mã hồ sơ / Ngày nộp
            </th>
            <td>
              <code>{data.product.id}</code> ·{' '}
              {data.isDraft
                ? 'BẢN NHÁP (Chưa nộp)'
                : `Đã nộp ngày ${formatViDateTime(data.product.submittedAt)}`}
            </td>
          </tr>
          <tr>
            <th scope='row'>Tên sản phẩm</th>
            <td>
              <strong>{data.product.name}</strong>
            </td>
          </tr>
          <tr>
            <th scope='row'>Nhóm ngành / Phân loại</th>
            <td>
              {data.category.groupName} · {data.category.name} ({data.category.classificationGroup}
              {data.category.classificationSubgroup
                ? ` / ${data.category.classificationSubgroup}`
                : ''}
              )
            </td>
          </tr>
          <tr>
            <th scope='row'>Loại hình đăng ký &amp; Năm đánh giá</th>
            <td>
              {formatFormValue(formData.registrationType, 'registrationType')} · Năm đánh giá:{' '}
              {formatFormValue(formData.assessmentYear, 'assessmentYear')} · Số lượng mẫu:{' '}
              {formatFormValue(formData.sampleQuantity, 'sampleQuantity')}
            </td>
          </tr>
          <tr>
            <th scope='row'>Mô tả sản phẩm</th>
            <td>{data.product.description || '—'}</td>
          </tr>
          <tr>
            <th scope='row'>Cam kết của chủ thể</th>
            <td>
              {formData.declarationAccepted
                ? 'Đã cam kết các thông tin và tài liệu minh chứng là trung thực, đúng quy định.'
                : 'Chưa xác nhận cam kết'}
            </td>
          </tr>
        </tbody>
      </table>

      {selectedImageIds.length > 0 && (
        <section className='print-selected-images'>
          <h2>III. HÌNH ẢNH SẢN PHẨM ĐƯỢC CHỌN</h2>
          <div className='print-image-grid'>
            {imageAttachments
              .filter((img) => selectedImageIds.includes(img.id))
              .map((img) => (
                <figure className='print-image-card' key={img.id}>
                  <PrivateAttachmentThumbnail
                    mode={attachmentMode}
                    productId={data.product.id}
                    attachmentId={img.id}
                    name={img.fileName}
                  />
                  <figcaption>{img.fileName}</figcaption>
                </figure>
              ))}
          </div>
        </section>
      )}

      <h2>IV. DANH MỤC TỆP HỒ SƠ &amp; MINH CHỨNG ĐÍNH KÈM ({data.attachments.length} tệp)</h2>
      <table className='print-table'>
        <thead>
          <tr>
            <th scope='col' style={{ width: '10%' }}>
              STT
            </th>
            <th scope='col' style={{ width: '55%' }}>
              Tên tệp đính kèm
            </th>
            <th scope='col' style={{ width: '15%' }}>
              Phân loại tệp
            </th>
            <th scope='col' style={{ width: '20%' }}>
              Thời điểm tải lên
            </th>
          </tr>
        </thead>
        <tbody>
          {data.attachments.length === 0 ? (
            <tr>
              <td colSpan={4}>Chưa có tệp minh chứng đính kèm.</td>
            </tr>
          ) : (
            data.attachments.map((att, index) => (
              <tr key={att.id}>
                <td className='print-num'>{index + 1}</td>
                <td>{att.fileName}</td>
                <td>{att.type === 'IMAGE' ? 'Ảnh sản phẩm' : 'Tài liệu minh chứng'}</td>
                <td>{formatViDateTime(att.createdAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <footer className='print-signatures'>
        <div>
          <strong>CƠ QUAN TIẾP NHẬN HỒ SƠ</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <strong>ĐẠI DIỆN CHỦ THỂ ĐĂNG KÝ</strong>
          <p>{formData.representativeName ?? data.registrant.fullName}</p>
        </div>
      </footer>
      <p className='print-footnote'>
        Thời điểm kết xuất phiếu đăng ký: {formatViDateTime(data.generatedAt)}
      </p>
    </article>
  );
}
