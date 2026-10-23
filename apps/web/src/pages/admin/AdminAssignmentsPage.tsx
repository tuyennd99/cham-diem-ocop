import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { compact, differenceBy, keyBy, pick, uniq, xor } from 'lodash';
import { Button } from '@/components/ui/button';
import { adminApi, productsApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import type { Assignment, AdminCategory as Category, AdminJudge as Judge } from '../../types/admin';

const assignmentKey = (item: Pick<Assignment, 'judgeId' | 'categoryId'>) =>
  `${item.judgeId}:${item.categoryId}`;

function buildAssignment(
  judge: Judge,
  category: Category,
  criterionIds: string[] = [],
): Assignment {
  return {
    judgeId: judge.id,
    categoryId: category.id,
    criterionIds,
    judge: pick(judge, ['id', 'email', 'fullName', 'isActive']),
    category: pick(category, ['id', 'name', 'groupCode', 'groupName']),
  };
}

export function AdminAssignmentsPage() {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const queryClient = useQueryClient();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [savedAssignments, setSavedAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [criterionIds, setCriterionIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (canManage) {
          const [j, c, a] = await Promise.all([
            adminApi.judges(),
            productsApi.categories(),
            adminApi.assignments(),
          ]);
          if (!active) return;
          setJudges(j.data.filter((item) => item.isActive));
          setCategories(c.data);
          setAssignments(a.data);
          setSavedAssignments(a.data);
        } else {
          const { data } = await adminApi.assignments();
          if (!active) return;
          setAssignments(data);
          setSavedAssignments(data);
        }
      } catch (cause) {
        if (active) setError(messageOf(cause));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [canManage]);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const originalByKey = keyBy(savedAssignments, assignmentKey);
  const added = differenceBy(assignments, savedAssignments, assignmentKey);
  const removed = differenceBy(savedAssignments, assignments, assignmentKey);
  const scopeChanged = assignments.filter((item) => {
    const saved = originalByKey[assignmentKey(item)];
    return saved && xor(saved.criterionIds, item.criterionIds).length > 0;
  });
  const dirty = Boolean(added.length || removed.length || scopeChanged.length);
  const touchedCategories = uniq(
    [...added, ...removed, ...scopeChanged].map(
      (item) => `${item.category.groupName} · ${item.category.name}`,
    ),
  );

  function applyScope() {
    if (!judgeId || !categoryId || !selectedCategory) return;
    const judge = judges.find((item) => item.id === judgeId);
    if (!judge) return;
    const existing = assignments.find(
      (item) => item.judgeId === judgeId && item.categoryId === categoryId,
    );
    const next: Assignment = existing
      ? { ...existing, criterionIds }
      : buildAssignment(judge, selectedCategory, criterionIds);
    setAssignments((current) =>
      existing ? current.map((item) => (item === existing ? next : item)) : [...current, next],
    );
    setNotice('');
  }

  function toggleCell(judge: Judge, category: Category) {
    const existing = assignments.find(
      (item) => item.judgeId === judge.id && item.categoryId === category.id,
    );
    setAssignments((current) =>
      existing
        ? current.filter((item) => item !== existing)
        : [...current, buildAssignment(judge, category)],
    );
    setNotice('');
  }

  async function save() {
    if (!canManage || !dirty) return;
    const diffText = `${added.length} thêm, ${removed.length} xóa, ${scopeChanged.length} đổi phạm vi`;
    const groupsText = touchedCategories.length
      ? touchedCategories.join(', ')
      : 'không có nhóm thay đổi';
    if (
      !window.confirm(
        `API sẽ thay thế TOÀN BỘ danh sách phân công hiện tại. Thay đổi: ${diffText}. Nhóm liên quan: ${groupsText}. Tiếp tục?`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await adminApi.replaceAssignments(
        assignments.map((item) => pick(item, ['judgeId', 'categoryId', 'criterionIds'])),
      );
      setAssignments(data);
      setSavedAssignments(data);
      setNotice('Đã thay thế toàn bộ phân công.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.judge.all });
    } catch (cause) {
      setError(
        `Chưa lưu được danh sách thay thế. Nhóm liên quan: ${groupsText}. ${messageOf(cause)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const coverage = categories.map((category) => {
    const criteria = category.criteriaSet?.criteria ?? [];
    const assigned = assignments.filter((item) => item.categoryId === category.id);
    const missing = criteria.filter(
      (criterion) =>
        !assigned.some(
          (item) => item.criterionIds.length === 0 || item.criterionIds.includes(criterion.id),
        ),
    );
    return { category, criteria, assigned, missing };
  });

  const formatChange = (prefix: string, item: Assignment) =>
    `${prefix}: ${item.judge.fullName} · ${item.category.groupName} / ${item.category.name}`;

  return (
    <section className='assignment-page'>
      <p className='eyebrow'>QUẢN TRỊ</p>
      <h1>Phân công giám khảo</h1>
      {canManage && (
        <p className='assignment-warning'>
          Lưu sẽ thay thế toàn bộ phân công hiện tại, không chỉ dòng đang sửa. Xem trước thay đổi và
          xác nhận trước khi gửi.
        </p>
      )}
      {error && (
        <p role='alert' className='form-note'>
          {error}
        </p>
      )}
      {notice && (
        <p role='status' className='form-success'>
          {notice}
        </p>
      )}
      {loading ? (
        <div className='dashboard-skeleton' aria-busy='true' aria-label='Đang tải phân công'>
          <div className='skeleton-table' />
        </div>
      ) : error && (!canManage || !categories.length) ? (
        <div className='empty-state'>
          <h2>Chưa tải được phân công</h2>
          <p>Kiểm tra quyền truy cập hoặc kết nối rồi thử lại.</p>
        </div>
      ) : !canManage ? (
        assignments.length ? (
          <section className='route-panel'>
            <h2>Danh sách phân công hiện tại</h2>
            <p>Tài khoản này có quyền xem nhưng không thể thay đổi phân công.</p>
            <div className='record-list'>
              {assignments.map((item) => (
                <article className='record-row' key={assignmentKey(item)}>
                  <div className='record-main'>
                    <h3>{item.judge.fullName}</h3>
                    <p>
                      {item.category.groupName} · {item.category.name}
                    </p>
                  </div>
                  <span>
                    {item.criterionIds.length
                      ? `${item.criterionIds.length} tiêu chí trong phạm vi`
                      : 'Toàn bộ tiêu chí'}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div className='empty-state'>
            <h2>Chưa có phân công</h2>
          </div>
        )
      ) : (
        <>
          <section className='route-panel assignment-editor'>
            <h2>Thêm hoặc sửa phạm vi</h2>
            <div className='assignment-form-grid'>
              <label>
                Giám khảo
                <select value={judgeId} onChange={(event) => setJudgeId(event.target.value)}>
                  <option value=''>Chọn giám khảo</option>
                  {judges.map((judge) => (
                    <option key={judge.id} value={judge.id}>
                      {judge.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nhóm sản phẩm
                <select
                  value={categoryId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const existing = assignments.find(
                      (item) => item.judgeId === judgeId && item.categoryId === nextId,
                    );
                    setCategoryId(nextId);
                    setCriterionIds(existing?.criterionIds ?? []);
                  }}
                >
                  <option value=''>Chọn nhóm</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.groupName} · {category.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedCategory && (
                <label className='assignment-criteria'>
                  Phạm vi tiêu chí
                  <select
                    multiple
                    value={criterionIds}
                    onChange={(event) =>
                      setCriterionIds(
                        Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                      )
                    }
                  >
                    {selectedCategory.criteriaSet?.criteria.map((criterion) => (
                      <option key={criterion.id} value={criterion.id}>
                        {criterion.code} · {criterion.name}
                      </option>
                    ))}
                  </select>
                  <span>Để trống nghĩa là giao toàn bộ tiêu chí.</span>
                </label>
              )}
              <Button
                type='button'
                variant='secondary'
                disabled={!judgeId || !categoryId}
                onClick={applyScope}
              >
                {assignments.some(
                  (item) => item.judgeId === judgeId && item.categoryId === categoryId,
                )
                  ? 'Cập nhật phạm vi'
                  : 'Thêm phân công'}
              </Button>
            </div>
          </section>
          <section className='assignment-matrix' aria-label='Ma trận phân công'>
            <div className='section-heading'>
              <div>
                <h2>Ma trận phủ tiêu chí</h2>
                <p>Mỗi ô thể hiện một phân công giữa giám khảo và nhóm sản phẩm.</p>
              </div>
            </div>
            {!judges.length || !categories.length ? (
              <div className='empty-state'>
                <h3>Chưa có nhóm hoặc giám khảo</h3>
                <p>Thêm dữ liệu danh mục và tài khoản giám khảo trước khi phân công.</p>
              </div>
            ) : (
              coverage.map(({ category, criteria, assigned, missing }) => (
                <article className='assignment-category' key={category.id}>
                  <div className='assignment-category-heading'>
                    <div>
                      <strong>
                        {category.groupName} · {category.name}
                      </strong>
                      <span>
                        {criteria.length
                          ? `${criteria.length - missing.length}/${criteria.length} tiêu chí có người phụ trách`
                          : 'Bộ tiêu chí chưa có dữ liệu'}
                      </span>
                    </div>
                    {missing.length > 0 && (
                      <strong className='coverage-warning'>
                        Thiếu phủ {missing.length} tiêu chí
                      </strong>
                    )}
                  </div>
                  <div className='assignment-judge-grid'>
                    {judges.map((judge) => {
                      const item = assigned.find((row) => row.judgeId === judge.id);
                      const scope = item
                        ? item.criterionIds.length
                          ? `${item.criterionIds.length} tiêu chí`
                          : 'Toàn bộ tiêu chí'
                        : 'Chưa phân công';
                      const criterionNames = compact(
                        item?.criterionIds.map(
                          (id) => criteria.find((criterion) => criterion.id === id)?.code,
                        ),
                      ).join(', ');
                      return (
                        <button
                          type='button'
                          className={`assignment-cell${item ? 'is-assigned' : ''}`}
                          key={judge.id}
                          aria-pressed={Boolean(item)}
                          onClick={() => toggleCell(judge, category)}
                        >
                          <strong>{judge.fullName}</strong>
                          <span>{scope}</span>
                          {criterionNames && <small>{criterionNames}</small>}
                        </button>
                      );
                    })}
                  </div>
                  {missing.length > 0 && (
                    <p className='coverage-warning-text'>
                      Chưa được giao:{' '}
                      {missing.map((item) => `${item.code} ${item.name}`).join(' · ')}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
          <section className='assignment-preview' aria-live='polite'>
            <h2>Xem trước thay đổi</h2>
            {dirty ? (
              <>
                <p>
                  {added.length} phân công thêm · {removed.length} phân công gỡ ·{' '}
                  {scopeChanged.length} phạm vi đổi
                </p>
                <ul>
                  {[
                    ...added.map((item) => formatChange('Thêm', item)),
                    ...removed.map((item) => formatChange('Gỡ', item)),
                    ...scopeChanged.map((item) => formatChange('Đổi phạm vi', item)),
                  ].map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Chưa có thay đổi so với danh sách đã lưu.</p>
            )}
          </section>
          <Button disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? 'Đang thay thế…' : 'Xác nhận thay thế toàn bộ phân công'}
          </Button>
        </>
      )}
    </section>
  );
}
