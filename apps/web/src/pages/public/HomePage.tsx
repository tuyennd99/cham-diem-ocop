import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { times } from 'lodash';
import { publicAttachmentUrl } from '../../constants/api';
import {
  PUBLIC_PRODUCT_STATUS_LABEL,
  PUBLIC_PRODUCT_STATUS_TONE,
} from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { homeFor, useSession } from '../../lib/auth';
import { useCategories, usePublicProducts } from '../../queries/common';
import type { FeaturedProduct } from '../../types/public';

export function HomePage() {
  const session = useSession();
  const workPath = session
    ? homeFor(session.user.role, session.user.staffPermissions)
    : homeFor('REGISTRANT');
  const [categoryId, setCategoryId] = useState('');
  const categoryRequest = useCategories();
  const productRequest = usePublicProducts<FeaturedProduct>({
    page: 1,
    limit: 6,
    categoryId: categoryId || undefined,
  });
  const categories = categoryRequest.data ?? [];
  const products = productRequest.data?.data ?? [];
  const loading = productRequest.isPending;
  const error = errorText(categoryRequest.error) || errorText(productRequest.error);

  function handleRetry() {
    void categoryRequest.refetch();
    void productRequest.refetch();
  }

  return (
    <main id='content'>
      <section className='hero section' id='home' aria-labelledby='hero-title'>
        <div className='hero-grid container'>
          <div className='hero-copy'>
            <p className='eyebrow'>ĐĂNG KÝ · CHẤM ĐIỂM · XẾP HẠNG</p>
            <h1 id='hero-title'>Theo dõi hồ sơ OCOP</h1>
            <p className='lead'>
              Tra cứu sản phẩm công khai, gửi hồ sơ đăng ký và theo dõi kết quả đánh giá trên cùng
              một hệ thống.
            </p>
            <div className='hero-actions'>
              <Link className='button button-primary' to={session ? workPath : '/register'}>
                {session ? 'Vào khu vực làm việc' : 'Đăng ký sản phẩm'}
              </Link>
              <Link className='button button-secondary' to='/products'>
                Tra cứu sản phẩm
              </Link>
            </div>
          </div>
          <aside className='hero-aside' aria-label='Dành cho chủ thể OCOP'>
            <p className='eyebrow'>DÀNH CHO CHỦ THỂ</p>
            <h2>Hồ sơ và tiến độ trong một tài khoản</h2>
            <p>
              Lưu bản nháp, bổ sung tài liệu, nộp hồ sơ và xem kết quả khi hội đồng hoàn tất đánh
              giá.
            </p>
            <Link className='text-link' to={session ? workPath : '/register'}>
              Mở khu vực hồ sơ →
            </Link>
          </aside>
        </div>
      </section>

      <section
        className='section featured-section'
        id='public-products'
        aria-labelledby='featured-title'
      >
        <div className='container'>
          <div className='section-heading'>
            <div>
              <p className='eyebrow'>TRA CỨU SẢN PHẨM</p>
              <h2 id='featured-title'>Sản phẩm công khai</h2>
              <p className='section-intro'>
                Hồ sơ hiển thị thông tin công bố, trạng thái xử lý và kết quả xếp hạng.
              </p>
            </div>
            <label className='field featured-filter'>
              <span>Nhóm sản phẩm</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={Boolean(error) && categories.length === 0}
              >
                <option value=''>Tất cả nhóm</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.groupName} · {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && (
            <div className='featured-grid' aria-busy='true' aria-label='Đang tải sản phẩm'>
              {times(6, (index) => (
                <div className='featured-card skeleton-card' key={index}>
                  <div className='skeleton-media' />
                  <div className='featured-card-body'>
                    <div className='skeleton-line' />
                    <div className='skeleton-line short' />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className='state-panel state-panel-error' role='alert'>
              <div className='state-panel-copy'>
                <p className='state-eyebrow'>TẠM THỜI GIÁN ĐOẠN KẾT NỐI</p>
                <h3>Chưa tải được danh sách sản phẩm công khai</h3>
                <p>
                  Hệ thống tra cứu đang tạm thời không phản hồi. Đây là lỗi kết nối máy chủ, không
                  phải danh mục trống. Bạn vẫn có thể đăng ký hồ sơ sản phẩm hoặc thử tải lại danh
                  sách.
                </p>
                <p className='state-tech-note'>Mã phản hồi: {error}</p>
              </div>
              <div className='state-actions'>
                <button type='button' className='button button-primary' onClick={handleRetry}>
                  Thử lại
                </button>
                <Link className='button button-secondary' to='/products'>
                  Mở trang tra cứu
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && !products.length && categoryId && (
            <div className='empty-state'>
              <h3>Chưa có sản phẩm trong nhóm này</h3>
              <p>
                Hiện chưa có hồ sơ công khai thuộc nhóm sản phẩm đang chọn. Hãy chọn nhóm khác hoặc
                xem toàn bộ danh mục.
              </p>
              <div className='state-actions'>
                <button
                  type='button'
                  className='button button-secondary'
                  onClick={() => setCategoryId('')}
                >
                  Xem tất cả nhóm
                </button>
                <Link className='button button-secondary' to='/products'>
                  Xem tất cả sản phẩm
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && !products.length && !categoryId && (
            <div className='empty-state'>
              <h3>Chưa có sản phẩm công khai</h3>
              <p>Hệ thống hiện chưa có hồ sơ sản phẩm nào ở trạng thái công bố công khai.</p>
              <div className='state-actions'>
                <Link className='button button-primary' to={session ? workPath : '/register'}>
                  {session ? 'Vào khu vực làm việc' : 'Đăng ký sản phẩm'}
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <>
              <div className='featured-grid'>
                {products.map((product) => {
                  const statusText =
                    PUBLIC_PRODUCT_STATUS_LABEL[
                      product.status as keyof typeof PUBLIC_PRODUCT_STATUS_LABEL
                    ];
                  const statusClass =
                    PUBLIC_PRODUCT_STATUS_TONE[
                      product.status as keyof typeof PUBLIC_PRODUCT_STATUS_TONE
                    ] ?? '';
                  return (
                    <article className='featured-card' key={product.id}>
                      <Link
                        to='/products/$id'
                        params={{ id: product.id }}
                        className='featured-image'
                      >
                        {product.attachments[0] ? (
                          <img
                            src={publicAttachmentUrl(product.id, product.attachments[0].id)}
                            alt={product.name}
                            loading='lazy'
                          />
                        ) : (
                          <span>Chưa có ảnh công khai</span>
                        )}
                      </Link>
                      <div className='featured-card-body'>
                        <div className='record-badges'>
                          <span className='badge badge-category'>
                            {product.category.groupName} · {product.category.name}
                          </span>
                          {statusText && (
                            <span className={`badge status-badge ${statusClass}`}>
                              {statusText}
                            </span>
                          )}
                        </div>
                        <h3>
                          <Link to='/products/$id' params={{ id: product.id }}>
                            {product.name}
                          </Link>
                        </h3>
                        {product.description && (
                          <p className='featured-card-desc'>{product.description}</p>
                        )}
                        <div className='featured-card-footer'>
                          {product.finalScore !== null && product.finalScore !== undefined ? (
                            <strong className='featured-score'>
                              {product.finalScore} điểm · {product.starRating} sao
                            </strong>
                          ) : (
                            <span className='featured-pending'>{statusText || 'Đang xử lý'}</span>
                          )}
                          <Link
                            className='text-link'
                            to='/products/$id'
                            params={{ id: product.id }}
                          >
                            Chi tiết →
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className='featured-footer'>
                <Link className='button button-secondary' to='/products'>
                  Xem tất cả sản phẩm
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section className='section workflow-section' id='workflow' aria-labelledby='workflow-title'>
        <div className='container'>
          <div className='section-heading section-heading-narrow'>
            <div>
              <p className='eyebrow'>QUY TRÌNH TRÊN HỆ THỐNG</p>
              <h2 id='workflow-title'>Từ hồ sơ đến kết quả xếp hạng</h2>
            </div>
            <p className='section-intro'>
              Các bước xử lý được ghi nhận trên hồ sơ để chủ thể và giám khảo theo dõi.
            </p>
          </div>
          <div className='steps-grid'>
            <article className='step-item'>
              <span className='step-number'>01</span>
              <h3>Gửi hồ sơ</h3>
              <p>Chủ thể đăng ký nhập thông tin sản phẩm và tải tài liệu minh chứng.</p>
            </article>
            <article className='step-item'>
              <span className='step-number'>02</span>
              <h3>Đánh giá</h3>
              <p>Giám khảo chấm các tiểu tiêu chí theo bộ tiêu chí của nhóm sản phẩm.</p>
            </article>
            <article className='step-item'>
              <span className='step-number'>03</span>
              <h3>Tổng hợp kết quả</h3>
              <p>Hệ thống ghi nhận kết quả sau khi các phiếu đánh giá được nộp.</p>
            </article>
          </div>
        </div>
      </section>

      <section className='section criteria-section' id='criteria' aria-labelledby='criteria-title'>
        <div className='container'>
          <div className='section-heading section-heading-narrow'>
            <div>
              <p className='eyebrow'>QUYẾT ĐỊNH 26/2026/QĐ-TTg</p>
              <h2 id='criteria-title'>Thang điểm tối đa 100 điểm</h2>
            </div>
            <p className='section-intro'>
              Bộ tiêu chí cụ thể được áp dụng theo nhóm sản phẩm và dữ liệu do hệ thống quản lý.
            </p>
          </div>
          <div className='star-bands' aria-label='Ngưỡng điểm xếp hạng sao OCOP'>
            <div>
              <strong>5 sao</strong>
              <span>90–100 điểm</span>
            </div>
            <div>
              <strong>4 sao</strong>
              <span>70–89 điểm</span>
            </div>
            <div>
              <strong>3 sao</strong>
              <span>50–69 điểm</span>
            </div>
            <div>
              <strong>2 sao</strong>
              <span>30–49 điểm</span>
            </div>
            <div>
              <strong>1 sao</strong>
              <span>Dưới 30 điểm</span>
            </div>
          </div>
          <Link className='text-link source-link' to='/products'>
            Xem sản phẩm công khai →
          </Link>
        </div>
      </section>
    </main>
  );
}
export default HomePage;
