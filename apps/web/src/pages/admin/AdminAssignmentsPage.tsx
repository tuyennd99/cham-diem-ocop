import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { compact, differenceBy, keyBy, pick, uniq, xor } from 'lodash';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import { MultiCombobox } from '@/components/multi-combobox';
import PageSpin from '@/components/page-spin';
import { SimpleCombobox } from '@/components/simple-combobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminApi, productsApi } from '../../api';
import { ALL } from '../../constants/consts';
import { queryKeys } from '../../constants/query-key';
import { assignmentPayload, assignmentScopeFor } from '../../lib/admin-assignment-form';
import { parseAdminAssignmentSearch, type AdminAssignmentSearch } from '../../lib/admin-search';
import { messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import type { Assignment, AdminCategory as Category, AdminJudge as Judge } from '../../types/admin';

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
    category: pick(category, ['id', 'name']),
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
    [...added, ...removed, ...scopeChanged].map((item) => `${item.category.name}`),
  );

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Phân công có thay đổi chưa lưu. Rời trang và bỏ toàn bộ thay đổi?'),
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
    const categoriesText = touchedCategories.length
      ? touchedCategories.join(', ')
      : 'không có danh mục thay đổi';
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
        `Chưa lưu được danh sách thay thế. Danh mục liên quan: ${categoriesText}. ${messageOf(cause)}`,
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

  const visibleCategoriesForFilter = categories;

  const visibleCoverage = coverage.filter(({ category, missing }) => {
    if (appliedSearch.categoryId && category.id !== appliedSearch.categoryId) return false;
    if (appliedSearch.uncoveredOnly && missing.length === 0) return false;
    return true;
  });

  const formatChange = (prefix: string, item: Assignment) =>
    `${prefix}: ${item.judge.fullName} · ${item.category.name} (${
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
              ? 'Phân công giám khảo theo danh mục sản phẩm và phạm vi tiêu chí. Khi lưu sẽ cập nhật toàn bộ danh sách phân công.'
              : 'Xem danh sách phân công giám khảo theo danh mục sản phẩm và phạm vi tiêu chí.'}
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
        <div className='space-y-2'>
          <AlertError title='Không thể tải hoặc lưu phân công' errors={[error]} />
          <Button
            type='button'
            variant='secondary'
            size='sm'
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
        <PageSpin />
      ) : error && (!canManage || !categories.length) ? (
        <Card className='admin-table-region empty-card'>
          <h2>Chưa tải được dữ liệu phân công</h2>
          <p className='text-muted text-sm'>Kiểm tra quyền truy cập hoặc kết nối rồi thử lại.</p>
        </Card>
      ) : !canManage ? (
        assignments.length ? (
          <section className='admin-table-region p-6'>
            <h2 className='mb-1'>Danh sách phân công hiện tại</h2>
            <p className='text-muted mb-4 text-sm'>
              Tài khoản của bạn có quyền Xem dữ liệu (chỉ đọc), không có quyền thay đổi phân công.
            </p>
            <div className='record-list'>
              {assignments.map((item) => (
                <article className='record-row' key={assignmentKey(item)}>
                  <div className='record-main'>
                    <h3>{item.judge.fullName}</h3>
                    <p>{item.category.name}</p>
                  </div>
                  <Badge variant='secondary'>
                    {item.criterionIds.length
                      ? `${item.criterionIds.length} tiêu chí trong phạm vi`
                      : 'Toàn bộ tiêu chí'}
                  </Badge>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <Card className='admin-table-region empty-card'>
            <h2>Chưa có phân công giám khảo</h2>
          </Card>
        )
      ) : (
        <>
          <div className='admin-filters'>
            <FormField
              label='Lọc theo danh mục sản phẩm'
              htmlFor='assignment-filter-category'
              className='admin-filter-field'
              data-filter-width='group'
            >
              <Select
                value={appliedSearch.categoryId || ALL}
                onValueChange={(value) =>
                  applySearch({
                    ...appliedSearch,
                    categoryId: value === ALL ? undefined : value,
                  })
                }
              >
                <SelectTrigger id='assignment-filter-category'>
                  <SelectValue placeholder='Tất cả danh mục' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                  {visibleCategoriesForFilter.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <div className='flex flex-col justify-end gap-2'>
              <div className='inline-flex items-center gap-2'>
                <Checkbox
                  id='assignment-filter-uncovered'
                  checked={appliedSearch.uncoveredOnly ?? false}
                  onCheckedChange={(checked) =>
                    applySearch({
                      ...appliedSearch,
                      uncoveredOnly: checked === true ? true : undefined,
                    })
                  }
                />
                <Label htmlFor='assignment-filter-uncovered' className='cursor-pointer'>
                  Chỉ hiển thị danh mục chưa phủ đủ tiêu chí
                </Label>
              </div>
              <p className='text-muted text-xs'>
                Đã phủ đủ <strong>{fullyCoveredCount}</strong> / <strong>{coverage.length}</strong>{' '}
                danh mục sản phẩm (tính trên toàn bộ danh mục).
              </p>
            </div>
          </div>

          <section className='admin-form filter-card assignment-editor'>
            <h2 className='mb-3'>Thêm hoặc chỉnh sửa phạm vi phân công</h2>
            <div className='admin-step-grid'>
              <FormField label='Giám khảo' htmlFor='admin-assignments-1'>
                <SimpleCombobox
                  id='admin-assignments-1'
                  options={judges.map((judge) => ({
                    value: judge.id,
                    label: `${judge.fullName} (${judge.email})`,
                  }))}
                  value={judgeId}
                  onChange={(nextJudgeId) => {
                    setJudgeId(nextJudgeId);
                    const nextScope = assignmentScopeFor(assignments, nextJudgeId, categoryId);
                    setCriterionIds(nextScope);
                    setScopeMode(nextScope.length > 0 ? 'specific' : 'all');
                  }}
                  placeholder='Chọn giám khảo'
                  searchPlaceholder='Tìm tên hoặc email giám khảo...'
                />
              </FormField>

              <FormField label='Danh mục sản phẩm' htmlFor='admin-assignments-2'>
                <SimpleCombobox
                  id='admin-assignments-2'
                  options={categories.map((category) => ({
                    value: category.id,
                    label: `${category.name}`,
                  }))}
                  value={categoryId}
                  onChange={(nextCategoryId) => {
                    setCategoryId(nextCategoryId);
                    const nextScope = assignmentScopeFor(assignments, judgeId, nextCategoryId);
                    setCriterionIds(nextScope);
                    setScopeMode(nextScope.length > 0 ? 'specific' : 'all');
                  }}
                  placeholder='Chọn danh mục sản phẩm'
                  searchPlaceholder='Tìm danh mục sản phẩm...'
                />
              </FormField>

              {selectedCategory && (
                <div className='admin-step-span-2 grid gap-3'>
                  <fieldset className='grid gap-2'>
                    <legend className='mb-1 text-sm font-semibold'>Phạm vi chấm điểm</legend>
                    <RadioGroup
                      value={scopeMode}
                      onValueChange={(value) => {
                        if (value === 'all') {
                          setScopeMode('all');
                          setCriterionIds([]);
                        } else {
                          setScopeMode('specific');
                        }
                      }}
                    >
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem value='all' id='assignment-scope-all' />
                        <Label htmlFor='assignment-scope-all' className='cursor-pointer'>
                          Toàn bộ tiêu chí của danh mục ({selectedCategory.name})
                        </Label>
                      </div>
                      <div className='flex items-center gap-2'>
                        <RadioGroupItem value='specific' id='assignment-scope-specific' />
                        <Label htmlFor='assignment-scope-specific' className='cursor-pointer'>
                          Chọn tiêu chí cụ thể
                        </Label>
                      </div>
                    </RadioGroup>
                  </fieldset>

                  {scopeMode === 'specific' && (
                    <FormField
                      label='Tiêu chí cụ thể'
                      htmlFor='assignment-specific-criteria'
                      className='gap-2'
                    >
                      <MultiCombobox
                        id='assignment-specific-criteria'
                        options={(selectedCategory.criteriaSet?.criteria ?? []).map(
                          (criterion) => ({
                            value: criterion.id,
                            label: `${criterion.code} · ${criterion.name} (tối đa ${criterion.maxScore} điểm)`,
                          }),
                        )}
                        value={criterionIds}
                        onChange={(nextIds) => setCriterionIds(uniq(nextIds))}
                        placeholder='— Chọn tiêu chí phân công —'
                        searchPlaceholder='Tìm mã hoặc tên tiêu chí...'
                      />
                      {specificInvalid && (
                        <p className='text-muted text-xs' role='status'>
                          Chọn ít nhất 1 tiêu chí cụ thể hoặc chuyển sang &ldquo;Toàn bộ tiêu
                          chí&rdquo;.
                        </p>
                      )}
                    </FormField>
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
              <h2>Ma trận phủ tiêu chí ({visibleCoverage.length} danh mục hiển thị)</h2>
              <p className='text-muted text-sm'>
                Chọn một ô giám khảo để đưa cặp giám khảo – danh mục vào khung chỉnh sửa phía trên.
                Bộ lọc chỉ thu gọn hiển thị; khi lưu vẫn giữ toàn bộ phân công của các danh mục
                khác.
              </p>
            </div>

            {!judges.length || !categories.length ? (
              <Card className='admin-table-region empty-card'>
                <h3>Chưa có danh mục hoặc giám khảo hoạt động</h3>
                <p className='text-muted text-sm'>
                  Thêm dữ liệu danh mục và tài khoản có quyền Chấm điểm trước khi phân công.
                </p>
              </Card>
            ) : visibleCoverage.length === 0 ? (
              <Card className='admin-table-region empty-card'>
                <h3>Không có danh mục khớp bộ lọc</h3>
                <div className='admin-actions mt-3 justify-center'>
                  <Button type='button' variant='secondary' onClick={() => applySearch({})}>
                    Xóa bộ lọc ma trận
                  </Button>
                </div>
              </Card>
            ) : (
              visibleCoverage.map(({ category, criteria, assigned, missing }) => (
                <article className='admin-table-region p-4' key={category.id}>
                  <div className='admin-page-heading' style={{ marginBottom: '12px' }}>
                    <div>
                      <h3 className='text-base font-semibold'>{category.name}</h3>
                      <p className='text-muted text-xs'>
                        {criteria.length
                          ? `Đã phủ ${criteria.length - missing.length}/${criteria.length} tiêu chí`
                          : 'Bộ tiêu chí chưa có dữ liệu'}
                      </p>
                    </div>
                    {missing.length > 0 ? (
                      <Badge variant='outline'>Thiếu phủ {missing.length} tiêu chí</Badge>
                    ) : (
                      <Badge variant='default'>Đã phủ đủ tiêu chí</Badge>
                    )}
                  </div>

                  <div className='assignment-judge-grid'>
                    {judges.map((judge) => {
                      const item = assigned.find((row) => row.judgeId === judge.id);
                      const isSelectedPair = judgeId === judge.id && categoryId === category.id;
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
                            className={`assignment-cell${item ? 'is-assigned' : ''}${
                              isSelectedPair ? 'ring-accent ring-2' : ''
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
                    <details className='text-muted mt-3 text-xs'>
                      <summary className='text-fg cursor-pointer font-semibold'>
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
                <p className='text-muted text-xs'>
                  Tổng tập sẽ gửi: {assignments.length} phân công (bao gồm cả các danh mục đang ẩn
                  bởi bộ lọc).
                </p>
              </div>
              <div className='admin-actions'>
                <Button type='button' variant='secondary' disabled={busy} onClick={discardChanges}>
                  Hủy thay đổi
                </Button>
                <Button
                  type='button'
                  loading={busy}
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
                  <strong>Danh mục liên quan ({touchedCategories.length}):</strong>
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

              {error && <AlertError title='Không thể lưu phân công' errors={[error]} />}

              <div className='admin-actions'>
                <Button
                  type='button'
                  loading={busy}
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
