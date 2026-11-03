import { useEffect, useMemo, useRef, useState } from 'react';
import type { Criterion, ScoreOption } from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker } from '@tanstack/react-router';
import { Check, ArrowLeft } from 'lucide-react';
import { isEqual, keyBy, mapValues, maxBy, partition, sumBy } from 'lodash';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { PageContainer, PageHeader } from '@/layouts/PageLayout';
import { judgeApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { errorText, messageOf } from '../../lib/api-error';
import { openAttachment } from '../../lib/attachments';
import { partitionFormEntries } from '../../lib/utils';
import { useEvaluation } from '../../queries/judge';
import type { EvaluationData } from '../../types/judge';
import { PrivateAttachmentThumbnail } from '../registrant/AttachmentLink';

type SubCriterion = Criterion['subCriteria'][number];

async function openJudgeAttachment(productId: string, attachmentId: string, fileName: string) {
  try {
    await openAttachment(await judgeApi.attachment(productId, attachmentId), fileName);
  } catch (cause) {
    toast.error(messageOf(cause));
  }
}

function scoreSubCriteria(items: SubCriterion[], selected: Record<string, string>): number {
  return sumBy(
    items,
    (sub) => sub.options.find((option) => option.id === selected[sub.id])?.points ?? 0,
  );
}

export function JudgeEvaluationPage({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const {
    data: remoteData = null,
    error: loadError,
    isPending: loading,
    isFetching,
    refetch,
  } = useEvaluation(productId);
  const [data, setData] = useState<EvaluationData | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedSelected, setSavedSelected] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [activeCriterionId, setActiveCriterionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const seededProductIdRef = useRef('');

  useEffect(() => {
    if (!remoteData) return;
    setData(remoteData);
    if (seededProductIdRef.current !== remoteData.product.id) {
      seededProductIdRef.current = remoteData.product.id;
      const scoresBySubCriterion = keyBy(remoteData.evaluation.scores, 'subCriterionId');
      const initialSelected = mapValues(scoresBySubCriterion, 'optionId');
      const initialNotes = mapValues(scoresBySubCriterion, (score) => score.note ?? '');
      setSelected(initialSelected);
      setNotes(initialNotes);
      setSavedSelected(initialSelected);
      setSavedNotes(initialNotes);
      setActiveCriterionId(remoteData.criteria[0]?.id ?? '');
    }
  }, [remoteData]);

  const isLocked = data?.evaluation.status === 'SUBMITTED';
  const isDirty =
    Boolean(data) &&
    !isLocked &&
    (!isEqual(selected, savedSelected) || !isEqual(notes, savedNotes));

  useBlocker({
    shouldBlockFn: () =>
      isDirty &&
      !window.confirm('Bạn có điểm hoặc ghi chú chưa lưu. Rời trang và bỏ thay đổi vừa nhập?'),
    enableBeforeUnload: () => isDirty,
  });

  const subcriteria = useMemo(
    () => data?.criteria.flatMap((criterion) => criterion.subCriteria) ?? [],
    [data],
  );
  const total = scoreSubCriteria(subcriteria, selected);
  const maxPossibleScore = sumBy(subcriteria, (sub) =>
    Math.max(0, maxBy(sub.options, 'points')?.points ?? 0),
  );
  const completedCriteria =
    data?.criteria.filter(
      (criterion) =>
        criterion.subCriteria.length > 0 &&
        criterion.subCriteria.every((sub) => Boolean(selected[sub.id])),
    ).length ?? 0;
  const activeIndex =
    data?.criteria.findIndex((criterion) => criterion.id === activeCriterionId) ?? -1;
  const activeCriterion = activeIndex >= 0 ? data?.criteria[activeIndex] : undefined;
  const completed = subcriteria.filter((sub) => Boolean(selected[sub.id])).length;

  const buildScores = () =>
    Object.entries(selected).map(([subCriterionId, optionId]) => ({
      subCriterionId,
      optionId,
      ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}),
    }));

  async function save() {
    if (!data) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await judgeApi.save(productId, { scores: buildScores() });
      setSavedSelected(selected);
      setSavedNotes(notes);
      setNotice('Đã lưu bản chấm.');
      toast.success('Đã lưu bản chấm.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.judge.queue });
    } catch (cause) {
      const msg = messageOf(cause);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function requestSubmit() {
    if (!subcriteria.every((sub) => Boolean(selected[sub.id]))) {
      setError('Chọn mức điểm cho mọi tiểu tiêu chí trước khi nộp.');
      return;
    }
    setSubmitConfirmOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await judgeApi.save(productId, { scores: buildScores() });
      const { data: result } = await judgeApi.submit(productId);
      setSavedSelected(selected);
      setSavedNotes(notes);
      setData((current) =>
        current
          ? {
              ...current,
              evaluation: { ...current.evaluation, status: result.status, total: result.total },
            }
          : current,
      );
      setSubmitConfirmOpen(false);
      setNotice('Đã nộp phiếu chấm.');
      toast.success('Đã nộp phiếu chấm.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.judge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    } catch (cause) {
      const msg = messageOf(cause);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const initialLoadError = errorText(loadError);

  if (initialLoadError && !data)
    return (
      <PageContainer>
        <PageHeader title='Phiếu chấm' />
        <AlertError title='Chưa tải được phiếu chấm' errors={[initialLoadError]} />
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            loading={isFetching}
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? 'Đang tải…' : 'Thử lại'}
          </Button>
          <Button asChild variant='secondary'>
            <Link to='/judge'>Quay lại hàng chờ</Link>
          </Button>
        </div>
      </PageContainer>
    );
  if (loading && !data)
    return (
      <PageContainer aria-busy='true' aria-label='Đang tải phiếu chấm'>
        <PageSpin />
      </PageContainer>
    );
  if (!data) return null;

  const locked = data.evaluation.status === 'SUBMITTED';
  const sections = [
    { key: 'A', label: 'A. Sản phẩm và sức mạnh cộng đồng' },
    { key: 'B', label: 'B. Khả năng tiếp thị' },
    { key: 'C', label: 'C. Chất lượng sản phẩm' },
    { key: 'other', label: 'Tiêu chí được phân công' },
  ];
  const [entityEntries, productEntries] = partitionFormEntries(data.product.formData);
  const [imageAttachments, documentAttachments] = partition(data.product.attachments, {
    type: 'IMAGE',
  });
  const renderFormSection = (title: string, rows: typeof entityEntries) => (
    <details className='judge-details'>
      <summary>{title}</summary>
      <dl className='detail-facts'>
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );

  return (
    <PageContainer className='judge-page'>
      <PageHeader
        className='judge-page-header'
        backLink={
          <Link className='text-link inline-flex items-center gap-1 text-sm' to='/judge'>
            <ArrowLeft className='size-4' aria-hidden='true' />
            <span>Hàng chờ chấm</span>
          </Link>
        }
        title={data.product.name}
        badge={
          <Badge
            variant='outline'
            className={locked ? 'status-badge status-completed' : 'status-badge status-scoring'}
          >
            {locked ? 'Đã nộp · chỉ đọc' : 'Phiếu nháp'}
          </Badge>
        }
        description={
          <>
            {data.product.category.name} · Mã hồ sơ <code>{data.product.id}</code>
            {locked ? (
              <>
                {' · '}
                <strong>
                  {total}/{maxPossibleScore} điểm
                </strong>
              </>
            ) : null}
          </>
        }
        actions={
          <Button asChild variant='secondary'>
            <Link to='/print/judge/products/$id' params={{ id: productId }}>
              In phiếu chấm A4
            </Link>
          </Button>
        }
      />
      {locked && <p className='form-note'>Phiếu đã nộp và không thể chỉnh sửa.</p>}
      <div className='judge-workspace'>
        <aside className='judge-criteria-nav' aria-label='Điều hướng tiêu chí'>
          <div className='criteria-progress'>
            <strong>
              {completedCriteria}/{data.criteria.length} tiêu chí đã chọn đủ
            </strong>
            <div
              className='progress-track'
              role='progressbar'
              aria-label='Tiến độ tiêu chí'
              aria-valuemin={0}
              aria-valuemax={data.criteria.length}
              aria-valuenow={completedCriteria}
            >
              <span
                style={{
                  width: `${data.criteria.length ? (completedCriteria / data.criteria.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          {sections.map((section) => {
            const items = data.criteria.filter((criterion) =>
              section.key === 'other'
                ? !/^[ABC]/i.test(criterion.code)
                : criterion.code.toUpperCase().startsWith(section.key),
            );
            return items.length ? (
              <div className='criteria-nav-group' key={section.key}>
                <h2>{section.label}</h2>
                {items.map((criterion) => {
                  const done =
                    criterion.subCriteria.length > 0 &&
                    criterion.subCriteria.every((sub) => Boolean(selected[sub.id]));
                  const score = scoreSubCriteria(criterion.subCriteria, selected);
                  return (
                    <button
                      type='button'
                      className={`criterion-nav-item ${criterion.id === activeCriterionId ? 'is-current' : ''}`}
                      key={criterion.id}
                      aria-current={criterion.id === activeCriterionId ? 'true' : undefined}
                      onClick={() => setActiveCriterionId(criterion.id)}
                    >
                      <span className='criterion-nav-name'>
                        {criterion.code}. {criterion.name}
                      </span>
                      <span className='criterion-nav-meta'>
                        <span>
                          {score}/{criterion.maxScore} điểm
                        </span>
                        <span className='inline-flex items-center gap-1'>
                          {done && <Check className='size-3.5 text-accent' aria-hidden='true' />}
                          <span>{done ? 'Đã chấm' : 'Chưa chấm'}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null;
          })}
        </aside>
        <main className='judge-scoring-main'>
          <div className='criteria-summary'>
            <div>
              <h2>
                {activeCriterion
                  ? `${activeCriterion.code} — ${activeCriterion.name}`
                  : 'Chưa có tiêu chí được phân công'}
              </h2>
              {activeCriterion && (
                <p className='text-muted mt-1 text-xs'>
                  Tiêu chí {activeIndex + 1} / {data.criteria.length}
                </p>
              )}
            </div>
            {activeCriterion && (
              <Badge variant='secondary'>Tối đa {activeCriterion.maxScore} điểm</Badge>
            )}
          </div>
          {activeCriterion ? (
            <div className='subcriteria-list'>
              {activeCriterion.subCriteria.map((sub) => (
                <fieldset className='score-card' key={sub.id} disabled={locked}>
                  <legend>{sub.content}</legend>
                  <RadioGroup
                    className='score-options'
                    value={selected[sub.id] ?? ''}
                    disabled={locked}
                    onValueChange={(optionId) => {
                      setSelected((current) => ({ ...current, [sub.id]: optionId }));
                      setNotice('');
                      setError('');
                    }}
                  >
                    {sub.options.map((option: ScoreOption) => {
                      const optionInputId = `score-${sub.id}-${option.id}`;
                      return (
                        <div
                          className={`score-option relative ${selected[sub.id] === option.id ? 'is-selected' : ''}`}
                          key={option.id}
                        >
                          <RadioGroupItem value={option.id} id={optionInputId} />
                          <Label
                            htmlFor={optionInputId}
                            className='cursor-pointer leading-normal after:absolute after:inset-0'
                          >
                            {option.label}
                          </Label>
                          <strong>{option.points} điểm</strong>
                        </div>
                      );
                    })}
                  </RadioGroup>
                  {(!locked || Boolean(notes[sub.id]?.trim())) && (
                    <details className='judge-note' open={Boolean(notes[sub.id]?.trim())}>
                      <summary>
                        Ghi chú của giám khảo
                        {notes[sub.id]?.trim() ? ' (Đã có ghi chú)' : ''}
                      </summary>
                      <Label htmlFor={`note-${sub.id}`}>Ghi chú (không bắt buộc)</Label>
                      <Textarea
                        id={`note-${sub.id}`}
                        rows={3}
                        maxLength={2000}
                        value={notes[sub.id] ?? ''}
                        onChange={(event) => {
                          setNotes((current) => ({ ...current, [sub.id]: event.target.value }));
                          setNotice('');
                        }}
                      />
                    </details>
                  )}
                </fieldset>
              ))}
            </div>
          ) : (
            <div className='empty-state'>
              <p>Chưa có tiêu chí nào được phân công cho phiếu này.</p>
            </div>
          )}
          <div className='judge-criterion-nav'>
            <Button
              variant='secondary'
              disabled={activeIndex <= 0}
              onClick={() => setActiveCriterionId(data.criteria[activeIndex - 1]?.id ?? '')}
            >
              ← Tiêu chí trước
            </Button>
            <span>
              {completed}/{subcriteria.length} tiểu tiêu chí đã chọn
            </span>
            <Button
              variant='secondary'
              disabled={activeIndex < 0 || activeIndex >= data.criteria.length - 1}
              onClick={() => setActiveCriterionId(data.criteria[activeIndex + 1]?.id ?? '')}
            >
              Tiêu chí tiếp theo →
            </Button>
          </div>
          {!locked && (
            <footer className='judge-submit-bar'>
              <div className='judge-score-total'>
                <strong aria-live='polite'>{total}</strong>
                <span>/ {maxPossibleScore} điểm tạm tính</span>
              </div>
              <span className='autosave-state' role='status'>
                {notice || (isDirty ? 'Bản nháp có thay đổi chưa lưu' : 'Đã lưu nháp')}
              </span>
              {error && <AlertError title='Không thể lưu hoặc nộp phiếu chấm' errors={[error]} />}
              <div className='judge-submit-actions'>
                <Button
                  variant='secondary'
                  loading={busy}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? 'Đang lưu…' : 'Lưu nháp'}
                </Button>
                <Button
                  loading={busy}
                  disabled={busy || !data.criteria.length}
                  onClick={requestSubmit}
                >
                  {busy ? 'Đang nộp…' : 'Nộp phiếu chấm'}
                </Button>
              </div>
            </footer>
          )}
        </main>
        <aside className='judge-evidence-panel' aria-label='Thông tin sản phẩm và minh chứng'>
          <h2>Minh chứng hồ sơ</h2>
          {imageAttachments.length ? (
            <div className='evidence-gallery'>
              {imageAttachments.map((file) => (
                <button
                  type='button'
                  className='evidence-thumb'
                  key={file.id}
                  onClick={() => void openJudgeAttachment(productId, file.id, file.fileName)}
                  aria-label={`Mở ảnh ${file.fileName}`}
                >
                  <span className='evidence-thumb-frame'>
                    <PrivateAttachmentThumbnail
                      mode='judge'
                      productId={productId}
                      attachmentId={file.id}
                      name={file.fileName}
                    />
                  </span>
                  <span className='evidence-thumb-caption'>{file.fileName}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className='text-muted mb-3 text-sm'>Chưa có hình ảnh sản phẩm đính kèm.</p>
          )}
          <section className='evidence-files'>
            <h3>Tệp minh chứng</h3>
            {documentAttachments.length ? (
              <ul>
                {documentAttachments.map((file) => (
                  <li key={file.id}>
                    <Button
                      type='button'
                      variant='link'
                      className='attachment-link-btn text-link h-auto min-h-0 justify-start p-0 text-left'
                      onClick={() => void openJudgeAttachment(productId, file.id, file.fileName)}
                    >
                      {/\.pdf$/i.test(file.fileName) ? 'PDF · ' : 'Tệp · '}
                      {file.fileName}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-muted text-sm'>Không có tệp minh chứng bổ sung.</p>
            )}
          </section>
          <div className='mt-3'>
            {renderFormSection('Thông tin đơn vị sản xuất', entityEntries)}
            {renderFormSection('Thông tin sản phẩm', productEntries)}
          </div>
        </aside>
      </div>
      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setSubmitConfirmOpen(false);
        }}
        title='Nộp phiếu chấm?'
        description='Sau khi nộp, phiếu chấm sẽ được chốt điểm và chuyển sang chế độ chỉ đọc.'
        confirmLabel='Xác nhận nộp phiếu'
        pending={busy}
        onConfirm={() => void submit()}
      />
    </PageContainer>
  );
}
