import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { compact, differenceBy, keyBy, pick, uniq, xor } from 'lodash';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminApi, productsApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import {
  assignmentPayload,
  assignmentScopeFor,
} from '../../lib/admin-assignment-form';
import {
  parseAdminAssignmentSearch,
  type AdminAssignmentSearch,
} from '../../lib/admin-search';
import { messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import type {
  AdminCategory as Category,
  AdminJudge as Judge,
  Assignment,
} from '../../types/admin';

interface AdminAssignmentsPageProps {
  search?: AdminAssignmentSearch;
  onSearchChange?: (next: AdminAssignmentSearch) => void;
}

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
    criterionIds: [...criterionIds],
    judge: pick(judge, ['id', 'email', 'fullName', 'isActive']),
    category: pick(category, ['id', 'name', 'groupCode', 'groupName']),
  };
}

export function AdminAssignmentsPage({
  search: controlledSearch,
  onSearchChange,
}: AdminAssignmentsPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const queryClient = useQueryClient();

  const [fallbackSearch, setFallbackSearch] = useState<AdminAssignmentSearch>({});
  const appliedSearch = controlledSearch ?? fallbackSearch;

  function applySearch(next: AdminAssignmentSearch) {
    const normalized = parseAdminAssignmentSearch(next as Record<string, unknown>);
    if (onSearchChange) {
      onSearchChange(normalized);
    } else {
      setFallbackSearch(normalized);
    }
  }

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
  const [scopeMode, setScopeMode] = useState<'all' | 'specific'>('all');
  const [criterionIds, setCriterionIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canManage) {
        const [j, c, a] = await Promise.all([
          adminApi.judges(),
          productsApi.categories(),
          adminApi.assignments(),
        ]);
        setJudges(j.data.filter((item) => item.isActive));
        setCategories(c.data);
        setAssignments(a.data);
        setSavedAssignments(a.data);
      } else {
        const { data } = await adminApi.assignments();
        setAssignments(data);
        setSavedAssignments(data);
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm('Phân công có thay đổi chưa lưu. Rời trang và bỏ toàn bộ thay đổi?'),
    enableBeforeUnload: () => dirty,
  });

  function syncScopeState(nextJudgeId: string, nextCategoryId: string, source = assignments) {
    const scoped = assignmentScopeFor(source, nextJudgeId, nextCategoryId);
    setCriterionIds(scoped);
    setScopeMode(scoped.length > 0 ? 'specific' : 'all');
  }

  function applyScope() {
    if (!judgeId || !categoryId || !selectedCategory) return;
    if (scopeMode === 'specific' && criterionIds.length === 0) return;
    const judge = judges.find((item) => item.id === judgeId);
    if (!judge) return;
    const effectiveCriterionIds = scopeMode === 'all' ? [] : criterionIds;
    const existing = assignments.find(
      (item) => item.judgeId === judgeId && item.categoryId === categoryId,
    );
    const next: Assignment = existing
      ? { ...existing, criterionIds: [...effectiveCriterionIds] }
      : buildAssignment(judge, selectedCategory, effectiveCriterionIds);
    setAssignments((current) =>
      existing ? current.map((item) => (item === existing ? next : item)) : [...current, next],
    );
    setNotice('Đã áp dụng vào bản thay đổi tạm thời. Nhấn "Lưu toàn bộ phân công" để ghi nhận.');
  }

  function selectCellForEdit(judge: Judge, category: Category) {
    setJudgeId(judge.id);
    setCategoryId(category.id);
    syncScopeState(judge.id, category.id);
  }

  function removeAssignment(targetJudgeId: string, targetCategoryId: string) {
    setAssignments((current) => {
      const next = current.filter(
        (item) => !(item.judgeId === targetJudgeId && item.categoryId === targetCategoryId),
      );
      if (judgeId === targetJudgeId && categoryId === targetCategoryId) {
        setCriterionIds([]);
        setScopeMode('all');
      }
      return next;
    });
    setNotice('Đã gỡ phân công khỏi bản thay đổi tạm thời.');
  }

  function discardChanges() {
    if (busy || !dirty) return;
    setAssignments(savedAssignments);
    syncScopeState(judgeId, categoryId, savedAssignments);
    setConfirmOpen(false);
    setError('');
    setNotice('Đã hủy các thay đổi chưa lưu và khôi phục bản phân công hiện hành.');
  }

  async function confirmSaveAll() {
    if (!canManage || !dirty || busy) return;
    const groupsText = touchedCategories.length
      ? touchedCategories.join(', ')
      : 'không có nhóm thay đổi';
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await adminApi.replaceAssignments(assignmentPayload(assignments));
      setAssignments(data);
      setSavedAssignments(data);
      syncScopeState(judgeId, categoryId, data);
      setConfirmOpen(false);
      setNotice('Đã lưu toàn bộ phân công giám khảo.');
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

  const fullyCoveredCount = coverage.filter(
    (row) => row.criteria.length > 0 && row.missing.length === 0,
  ).length;

  const groupOptions = uniq(categories.map((cat) => `${cat.groupCode}:::${cat.groupName}`)).map(
    (entry) => {
      const [code, name] = entry.split(':::');
      return { code, name };
    },
  );

  const visibleCategoriesForFilter = appliedSearch.groupId
    ? categories.filter((cat) => cat.groupCode === appliedSearch.groupId)
    : categories;

  const visibleCoverage = coverage.filter(({ category, missing }) => {
    if (appliedSearch.groupId && category.groupCode !== appliedSearch.groupId) return false;
    if (appliedSearch.categoryId && category.id !== appliedSearch.categoryId) return false;
    if (appliedSearch.uncoveredOnly && missing.length === 0) return false;
    return true;
  });

  const formatChange = (prefix: string, item: Assignment) =>
    `${prefix}: ${item.judge.fullName} · ${item.category.groupName} / ${item.category.name} (${
      item.criterionIds.length ? `${item.criterionIds.length} tiêu chí` : 'Toàn bộ tiêu chí'
    })`;

  const specificInvalid = scopeMode === 'specific' && criterionIds.length === 0;

  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div>
          <h1>Phân công giám khảo</h1>
          <p className='route-intro'>
            {canManage
              ? 'Phân công giám khảo theo phân loại sản phẩm và phạm vi tiêu chí. Khi lưu sẽ cập nhật toàn bộ danh sách phân công.'
              : 'Xem danh sách phân công giám khảo theo phân loại sản phẩm và phạm vi tiêu chí.'}
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            disabled={loading || busy}
            onClick={() => void loadData()}
          >
            Tải lại
          </Button>
        </div>
      </div>

      {error && (
        <div role='alert' className='form-note'>
          <p>{error}</p>
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='mt-2'
            disabled={loading || busy}
            onClick={() => void loadData()}
          >
            Thử lại
          </Button>
        </div>
      )}

      {notice && (
        <p role='status' className='form-message'>
          {notice}
        </p>
      )}

      {loading ? (
        <div className='dashboard-skeleton' aria-busy='true' aria-label='Đang tải phân công'>
          <div className='skeleton-table' />
        </div>
      ) : error && (!canManage || !categories.length) ? (
        <div className='admin-table-region empty-card'>
          <h2>Chưa tải được dữ liệu phân công</h2>
          <p className='text-sm text-muted'>Kiểm tra quyền truy cập hoặc kết nối rồi thử lại.</p>
        </div>
      ) : !canManage ? (
        assignments.length ? (
          <section className='admin-table-region p-6'>
            <h2 className='mb-1'>Danh sách phân công hiện tại</h2>
            <p className='text-sm text-muted mb-4'>
              Tài khoản của bạn có quyền Xem dữ liệu (chỉ đọc), không có quyền thay đổi phân công.
            </p>
            <div className='record-list'>
              {assignments.map((item) => (
                <article className='record-row' key={assignmentKey(item)}>
                  <div className='record-main'>
                    <h3>{item.judge.fullName}</h3>
                    <p>
                      {item.category.groupName} · {item.category.name}
                    </p>
                  </div>
                  <span className='cat-tag'>
                    {item.criterionIds.length
                      ? `${item.criterionIds.length} tiêu chí trong phạm vi`
                      : 'Toàn bộ tiêu chí'}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div className='admin-table-region empty-card'>
            <h2>Chưa có phân công giám khảo</h2>
          </div>
        )
      ) : (
        <>
          <div className='admin-filters'>
            <label
              className='admin-filter-field'
              data-filter-width='group'
              htmlFor='assignment-filter-group'
            >
              Lọc theo nhóm lớn
              <select
                id='assignment-filter-group'
                value={appliedSearch.groupId ?? ''}
                onChange={(event) => {
                  const nextGroup = event.target.value || undefined;
                  const categoryStillMatches =
                    !nextGroup ||
                    categories.some(
                      (cat) =>
                        cat.id === appliedSearch.categoryId && cat.groupCode === nextGroup,
                    );
                  applySearch({
                    ...appliedSearch,
                    groupId: nextGroup,
                    categoryId: categoryStillMatches ? appliedSearch.categoryId : undefined,
                  });
                }}
              >
                <option value=''>Tất cả nhóm lớn</option>
                {groupOptions.map((group) => (
                  <option key={group.code} value={group.code}>
                    {group.code} · {group.name}
                  </option>
                ))}
              </select>
            </label>

            <label
              className='admin-filter-field'
              data-filter-width='group'
              htmlFor='assignment-filter-category'
            >
              Lọc theo phân loại sản phẩm
              <select
                id='assignment-filter-category'
                value={appliedSearch.categoryId ?? ''}
                onChange={(event) =>
                  applySearch({
                    ...appliedSearch,
                    categoryId: event.target.value || undefined,
                  })
                }
              >
                <option value=''>Tất cả phân loại</option>
                {visibleCategoriesForFilter.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.groupName} · {category.name}
                  </option>
                ))}
              </select>
            </label>

            <div className='flex flex-col justify-end gap-2'>
              <label
                htmlFor='assignment-filter-uncovered'
                className='inline-flex items-center gap-2 cursor-pointer'
              >
                <input
                  id='assignment-filter-uncovered'
                  type='checkbox'
                  checked={appliedSearch.uncoveredOnly ?? false}
                  onChange={(event) =>
                    applySearch({
                      ...appliedSearch,
                      uncoveredOnly: event.target.checked ? true : undefined,
                    })
                  }
                />
                <span>Chỉ hiển thị phân loại chưa phủ đủ tiêu chí</span>
              </label>
              <p className='text-xs text-muted'>
                Đã phủ đủ <strong>{fullyCoveredCount}</strong> /{' '}
                <strong>{coverage.length}</strong> phân loại sản phẩm (tính trên toàn bộ danh mục).
              </p>
            </div>
          </div>

          <section className='admin-form filter-card assignment-editor'>
            <h2 className='mb-3'>Thêm hoặc chỉnh sửa phạm vi phân công</h2>
            <div className='admin-step-grid'>
              <label htmlFor='assignment-judge-select'>
                Giám khảo
                <select
                  id='assignment-judge-select'
                  value={judgeId}
                  onChange={(event) => {
                    const nextJudgeId = event.target.value;
                    setJudgeId(nextJudgeId);
                    const nextScope = assignmentScopeFor(assignments, nextJudgeId, categoryId);
                    setCriterionIds(nextScope);
                    setScopeMode(nextScope.length > 0 ? 'specific' : 'all');
                  }}
                >
                  <option value=''>Chọn giám khảo</option>
                  {judges.map((judge) => (
                    <option key={judge.id} value={judge.id}>
                      {judge.fullName} ({judge.email})
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor='assignment-category-select'>
                Phân loại sản phẩm
                <select
                  id='assignment-category-select'
                  value={categoryId}
                  onChange={(event) => {
                    const nextCategoryId = event.target.value;
                    setCategoryId(nextCategoryId);
                    const nextScope = assignmentScopeFor(assignments, judgeId, nextCategoryId);
                    setCriterionIds(nextScope);
                    setScopeMode(nextScope.length > 0 ? 'specific' : 'all');
                  }}
                >
                  <option value=''>Chọn phân loại sản phẩm</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.groupName} · {category.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCategory && (
                <div className='admin-step-span-2 grid gap-3'>
                  <fieldset className='grid gap-2'>
                    <legend className='font-semibold text-sm mb-1'>Phạm vi chấm điểm</legend>
                    <label className='inline-flex items-center gap-2 cursor-pointer'>
                      <input
                        type='radio'
                        name='assignment-scope-mode'
                        checked={scopeMode === 'all'}
                        onChange={() => {
                          setScopeMode('all');
                          setCriterionIds([]);
                        }}
                      />
                      <span>Toàn bộ tiêu chí của phân loại ({selectedCategory.name})</span>
                    </label>
                    <label className='inline-flex items-center gap-2 cursor-pointer'>
                      <input
                        type='radio'
                        name='assignment-scope-mode'
                        checked={scopeMode === 'specific'}
                        onChange={() => setScopeMode('specific')}
                      />
                      <span>Chọn tiêu chí cụ thể</span>
                    </label>
                  </fieldset>

                  {scopeMode === 'specific' && (
                    <div
                      className='admin-table-region p-3 grid gap-2'
                      style={{ maxHeight: '260px', overflowY: 'auto' }}
                      role='group'
                      aria-label='Danh sách tiêu chí phân công'
                    >
                      {selectedCategory.criteriaSet?.criteria.map((criterion) => {
                        const checked = criterionIds.includes(criterion.id);
                        return (
                          <label
                            key={criterion.id}
                            className='inline-flex items-start gap-2 cursor-pointer text-sm font-normal'
                          >
                            <input
                              type='checkbox'
                              checked={checked}
                              onChange={(event) => {
                                const isChecked = event.target.checked;
                                setCriterionIds((current) =>
                                  isChecked
                                    ? uniq([...current, criterion.id])
                                    : current.filter((id) => id !== criterion.id),
                                );
                              }}
                            />
                            <span>
                              <strong>{criterion.code}</strong> · {criterion.name} (tối đa{' '}
                              {criterion.maxScore} điểm)
                            </span>
                          </label>
                        );
                      })}
                      {specificInvalid && (
                        <p className='text-xs text-muted' role='status'>
                          Chọn ít nhất 1 tiêu chí cụ thể hoặc chuyển sang &ldquo;Toàn bộ tiêu
                          chí&rdquo;.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className='admin-actions admin-step-span-2'>
                <Button
                  type='button'
                  disabled={!judgeId || !categoryId || specificInvalid}
                  onClick={applyScope}
                >
                  {assignments.some(
                    (item) => item.judgeId === judgeId && item.categoryId === categoryId,
                  )
                    ? 'Áp dụng cập nhật phạm vi'
                    : 'Áp dụng vào bản thay đổi'}
                </Button>
                {judgeId &&
                  categoryId &&
                  assignments.some(
                    (item) => item.judgeId === judgeId && item.categoryId === categoryId,
                  ) && (
                    <Button
                      type='button'
                      variant='destructive'
                      onClick={() => removeAssignment(judgeId, categoryId)}
                    >
                      Gỡ phân công cặp đang chọn
                    </Button>
                  )}
              </div>
            </div>
          </section>

          <section className='assignment-matrix grid gap-4' aria-label='Ma trận phân công'>
            <div>
              <h2>Ma trận phủ tiêu chí ({visibleCoverage.length} phân loại hiển thị)</h2>
              <p className='text-sm text-muted'>
                Chọn một ô giám khảo để đưa cặp giám khảo – phân loại vào khung chỉnh sửa phía trên.
                Bộ lọc chỉ thu gọn hiển thị; khi lưu vẫn giữ toàn bộ phân công của các phân loại
                khác.
              </p>
            </div>

            {!judges.length || !categories.length ? (
              <div className='admin-table-region empty-card'>
                <h3>Chưa có phân loại hoặc giám khảo hoạt động</h3>
                <p className='text-sm text-muted'>
                  Thêm dữ liệu danh mục và tài khoản có quyền Chấm điểm trước khi phân công.
                </p>
              </div>
            ) : visibleCoverage.length === 0 ? (
              <div className='admin-table-region empty-card'>
                <h3>Không có phân loại khớp bộ lọc</h3>
                <div className='admin-actions justify-center mt-3'>
                  <Button type='button' variant='secondary' onClick={() => applySearch({})}>
                    Xóa bộ lọc ma trận
                  </Button>
                </div>
              </div>
            ) : (
              visibleCoverage.map(({ category, criteria, assigned, missing }) => (
                <article className='admin-table-region p-4' key={category.id}>
                  <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                    <div>
                      <h3 className='font-semibold text-base'>
                        {category.groupName} · {category.name}
                      </h3>
                      <p className='text-xs text-muted'>
                        {criteria.length
                          ? `Đã phủ ${criteria.length - missing.length}/${criteria.length} tiêu chí`
                          : 'Bộ tiêu chí chưa có dữ liệu'}
                      </p>
                    </div>
                    {missing.length > 0 ? (
                      <span className='status-badge scoring'>
                        Thiếu phủ {missing.length} tiêu chí
                      </span>
                    ) : (
                      <span className='status-badge completed'>Đã phủ đủ tiêu chí</span>
                    )}
                  </div>

                  <div className='assignment-judge-grid'>
                    {judges.map((judge) => {
                      const item = assigned.find((row) => row.judgeId === judge.id);
                      const isSelectedPair =
                        judgeId === judge.id && categoryId === category.id;
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
                        <div key={judge.id} className='grid gap-1'>
                          <button
                            type='button'
                            className={`assignment-cell${item ? ' is-assigned' : ''}${
                              isSelectedPair ? ' ring-2 ring-accent' : ''
                            }`}
                            aria-pressed={Boolean(item)}
                            onClick={() => selectCellForEdit(judge, category)}
                          >
                            <strong>{judge.fullName}</strong>
                            <span>{scope}</span>
                            {criterionNames && <small>{criterionNames}</small>}
                          </button>
                          {item && (
                            <Button
                              type='button'
                              variant='secondary'
                              size='sm'
                              disabled={busy}
                              aria-label={`Gỡ phân công ${judge.fullName} khỏi ${category.name}`}
                              onClick={() => removeAssignment(judge.id, category.id)}
                            >
                              Gỡ {judge.fullName}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {missing.length > 0 && (
                    <details className='mt-3 text-xs text-muted'>
                      <summary className='cursor-pointer font-semibold text-fg'>
                        Xem {missing.length} tiêu chí chưa có người phụ trách
                      </summary>
                      <p className='mt-1'>
                        {missing.map((item) => `${item.code} ${item.name}`).join(' · ')}
                      </p>
                    </details>
                  )}
                </article>
              ))
            )}
          </section>

          {dirty && (
            <div
              className='admin-assignment-sticky-bar'
              role='region'
              aria-label='Thanh thay đổi phân công chưa lưu'
            >
              <div>
                <strong className='text-sm'>
                  Thay đổi chưa lưu: {added.length} thêm · {removed.length} gỡ ·{' '}
                  {scopeChanged.length} đổi phạm vi
                </strong>
                <p className='text-xs text-muted'>
                  Tổng tập sẽ gửi: {assignments.length} phân công (bao gồm cả các phân loại đang ẩn
                  bởi bộ lọc).
                </p>
              </div>
              <div className='admin-actions'>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={busy}
                  onClick={discardChanges}
                >
                  Hủy thay đổi
                </Button>
                <Button
                  type='button'
                  disabled={busy || !dirty}
                  onClick={() => setConfirmOpen(true)}
                >
                  {busy ? 'Đang lưu…' : 'Lưu toàn bộ phân công'}
                </Button>
              </div>
            </div>
          )}

          <Dialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (!busy) setConfirmOpen(open);
            }}
          >
            <DialogContent className='admin-dialog max-w-2xl' data-admin-ui='true'>
              <DialogHeader>
                <DialogTitle>Xác nhận lưu toàn bộ phân công giám khảo</DialogTitle>
                <DialogDescription>
                  Hệ thống sẽ thay thế toàn bộ danh sách phân công bằng tập {assignments.length}{' '}
                  phân công hiện tại ({added.length} thêm, {removed.length} gỡ,{' '}
                  {scopeChanged.length} đổi phạm vi).
                </DialogDescription>
              </DialogHeader>

              <div className='grid gap-3 text-sm'>
                <div>
                  <strong>Phân loại liên quan ({touchedCategories.length}):</strong>
                  <p className='text-muted mt-0.5'>
                    {touchedCategories.length ? touchedCategories.join(', ') : 'Không có'}
                  </p>
                </div>
                <div>
                  <strong>Chi tiết thay đổi:</strong>
                  <ul className='mt-1 pl-5' style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {[
                      ...added.map((item) => formatChange('Thêm', item)),
                      ...removed.map((item) => formatChange('Gỡ', item)),
                      ...scopeChanged.map((item) => formatChange('Đổi phạm vi', item)),
                    ].map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {error && (
                <p className='form-note' role='alert'>
                  {error}
                </p>
              )}

              <div className='admin-actions'>
                <Button
                  type='button'
                  disabled={busy || !dirty}
                  onClick={() => void confirmSaveAll()}
                >
                  {busy ? 'Đang lưu…' : 'Xác nhận thay thế toàn bộ phân công'}
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                >
                  Đóng
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
