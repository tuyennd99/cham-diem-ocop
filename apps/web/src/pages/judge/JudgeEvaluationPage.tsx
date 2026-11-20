import { useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer, PageHeader } from '@/layouts/PageLayout';
import { ATTACHMENT_TYPE, EVALUATION_STATUS, type Criterion, type ScoreOption } from '@ocop/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker } from '@tanstack/react-router';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ImagePreviewDialog } from '@/components/image-preview-dialog';
import PageSpin from '@/components/page-spin';
import { ColumnResizeHandle, useResizableColumns } from '@/components/resizable-columns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { judgeApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { ApiError, errorText, messageOf } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { groupJudgeCriteria } from '../../lib/judge-criteria-groups';
import { displayProductCode } from '../../lib/print-format';
import { partitionFormEntries } from '../../lib/utils';
import { useEvaluation } from '../../queries/judge';
import type { EvaluationData } from '../../types/judge';
import {
  openProductAttachmentByMode,
  PrivateAttachmentThumbnail,
} from '../registrant/AttachmentLink';

type SubCriterion = Criterion['subCriteria'][number];

const JUDGE_WORKSPACE_STORAGE_KEY = 'ocop:judge-workspace-widths:v1';
const JUDGE_WORKSPACE_COLUMNS = {
  left: { defaultWidth: 240, minWidth: 200, maxWidth: 380 },
  right: { defaultWidth: 280, minWidth: 240, maxWidth: 480 },
};
const JUDGE_WORKSPACE_CENTER_MIN_WIDTH = 420;

function areStringRecordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

interface StoredJudgeDraft {
  baseVersionToken?: string;
  selected: Record<string, string>;
  notes: Record<string, string>;
}

function judgeDraftStorageKey(userId: string, productId: string): string {
  return `ocop:judge-draft:${userId}:${productId}`;
}

function readStoredJudgeDraft(storageKey: string): StoredJudgeDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    const selected =
      record.selected && typeof record.selected === 'object'
        ? (record.selected as Record<string, string>)
        : {};
    const notes =
      record.notes && typeof record.notes === 'object'
        ? (record.notes as Record<string, string>)
        : {};
    const baseVersionToken =
      typeof record.baseVersionToken === 'string' ? record.baseVersionToken : undefined;
    return { baseVersionToken, selected, notes };
  } catch {
    return null;
  }
}

function writeStoredJudgeDraft(storageKey: string, draft: StoredJudgeDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // ignore storage quota failures
  }
}

function clearStoredJudgeDraft(storageKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

function scoreSubCriteria(items: SubCriterion[], selected: Record<string, string>): number {
  return items.reduce(
    (sum, sub) => sum + (sub.options.find((option) => option.id === selected[sub.id])?.points ?? 0),
    0,
  );
}

function buildServerEvaluationState(remoteData: EvaluationData) {
  const validSubCriterionIds = new Set<string>();
  const validOptionsBySubCriterion = new Map<string, Set<string>>();
  for (const criterion of remoteData.criteria) {
    for (const sub of criterion.subCriteria) {
      validSubCriterionIds.add(sub.id);
      validOptionsBySubCriterion.set(sub.id, new Set(sub.options.map((opt) => opt.id)));
    }
  }
  const initialSelected: Record<string, string> = {};
  const initialNotes: Record<string, string> = {};
  for (const score of remoteData.evaluation.scores) {
    if (validOptionsBySubCriterion.get(score.subCriterionId)?.has(score.optionId)) {
      initialSelected[score.subCriterionId] = score.optionId;
    }
    if (validSubCriterionIds.has(score.subCriterionId) && score.note) {
      initialNotes[score.subCriterionId] = score.note;
    }
  }
  return { validSubCriterionIds, validOptionsBySubCriterion, initialSelected, initialNotes };
}

function filterDraftToAssigned(
  draft: StoredJudgeDraft,
  validSubCriterionIds: Set<string>,
  validOptionsBySubCriterion: Map<string, Set<string>>,
): { selected: Record<string, string>; notes: Record<string, string> } {
  const selected: Record<string, string> = {};
  for (const [subId, optionId] of Object.entries(draft.selected)) {
    if (validOptionsBySubCriterion.get(subId)?.has(optionId)) {
      selected[subId] = optionId;
    }
  }
  const notes: Record<string, string> = {};
  for (const [subId, note] of Object.entries(draft.notes)) {
    if (validSubCriterionIds.has(subId) && note) {
      notes[subId] = note;
    }
  }
  return { selected, notes };
}

export function JudgeEvaluationPage({ productId }: { productId: string }) {
  const session = useSession();
  const draftStorageKey = judgeDraftStorageKey(session?.user.id ?? 'anon', productId);
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
  const [versionToken, setVersionToken] = useState<string | undefined>(undefined);
  const [hasConflict, setHasConflict] = useState(false);
  const [activeCriterionId, setActiveCriterionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeAction, setActiveAction] = useState<'save' | 'submit' | null>(null);
  const busy = activeAction !== null;
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const seededProductIdRef = useRef('');
  const localStateRef = useRef({
    selected,
    notes,
    savedSelected,
    savedNotes,
    hasConflict,
    activeCriterionId,
  });
  localStateRef.current = {
    selected,
    notes,
    savedSelected,
    savedNotes,
    hasConflict,
    activeCriterionId,
  };
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const { containerStyle, ghostRef, getHandleProps } = useResizableColumns({
    storageKey: JUDGE_WORKSPACE_STORAGE_KEY,
    containerRef: workspaceRef,
    columns: JUDGE_WORKSPACE_COLUMNS,
    centerMinWidth: JUDGE_WORKSPACE_CENTER_MIN_WIDTH,
  });

  useEffect(() => {
    if (!remoteData) return;
    setData(remoteData);
    const seedKey = `${session?.user.id ?? 'anon'}:${remoteData.product.id}`;
    const { validSubCriterionIds, validOptionsBySubCriterion, initialSelected, initialNotes } =
      buildServerEvaluationState(remoteData);
    const remoteLocked =
      remoteData.evaluation.status === EVALUATION_STATUS.SUBMITTED ||
      remoteData.evaluation.status === EVALUATION_STATUS.EXCLUDED;

    if (seededProductIdRef.current !== seedKey) {
      seededProductIdRef.current = seedKey;
      setSavedSelected(initialSelected);
      setSavedNotes(initialNotes);

      const storedDraft = !remoteLocked ? readStoredJudgeDraft(draftStorageKey) : null;
      const filteredDraft = storedDraft
        ? filterDraftToAssigned(storedDraft, validSubCriterionIds, validOptionsBySubCriterion)
        : null;
      const draftDiffers =
        filteredDraft !== null &&
        (!areStringRecordsEqual(filteredDraft.selected, initialSelected) ||
          !areStringRecordsEqual(filteredDraft.notes, initialNotes));

      if (draftDiffers && filteredDraft && storedDraft) {
        setSelected(filteredDraft.selected);
        setNotes(filteredDraft.notes);
        setVersionToken(storedDraft.baseVersionToken ?? remoteData.evaluation.versionToken);
        if (
          storedDraft.baseVersionToken &&
          remoteData.evaluation.versionToken &&
          storedDraft.baseVersionToken !== remoteData.evaluation.versionToken
        ) {
          setHasConflict(true);
          setError(
            'Phiếu chấm trên máy chủ đã thay đổi từ một phiên khác. Bản nháp cục bộ của bạn vẫn được giữ lại.',
          );
          setNotice('Đang giữ bản nháp cục bộ (có xung đột phiên bản với máy chủ)');
        } else {
          setHasConflict(false);
          setNotice('Đã khôi phục bản nháp chưa lưu từ phiên làm việc trước.');
        }
      } else {
        setSelected(initialSelected);
        setNotes(initialNotes);
        setVersionToken(remoteData.evaluation.versionToken);
        setHasConflict(false);
        if (remoteLocked) {
          clearStoredJudgeDraft(draftStorageKey);
        }
      }
      setActiveCriterionId(remoteData.criteria[0]?.id ?? '');
      return;
    }

    const snap = localStateRef.current;
    const currentlyClean =
      areStringRecordsEqual(snap.selected, snap.savedSelected) &&
      areStringRecordsEqual(snap.notes, snap.savedNotes) &&
      !snap.hasConflict;

    if (remoteLocked || currentlyClean) {
      setSavedSelected(initialSelected);
      setSavedNotes(initialNotes);
      setSelected(initialSelected);
      setNotes(initialNotes);
      setVersionToken(remoteData.evaluation.versionToken);
      setHasConflict(false);
      if (remoteLocked) {
        clearStoredJudgeDraft(draftStorageKey);
      }
    }
    if (!remoteData.criteria.some((criterion) => criterion.id === snap.activeCriterionId)) {
      setActiveCriterionId(remoteData.criteria[0]?.id ?? '');
    }
  }, [remoteData, draftStorageKey, session?.user.id]);

  const sectionGroups = useMemo(() => (data ? groupJudgeCriteria(data.criteria) : []), [data]);

  const isLocked =
    data?.evaluation.status === EVALUATION_STATUS.SUBMITTED ||
    data?.evaluation.status === EVALUATION_STATUS.EXCLUDED;
  const isDirty =
    Boolean(data) &&
    !isLocked &&
    (!areStringRecordsEqual(selected, savedSelected) || !areStringRecordsEqual(notes, savedNotes));

  useEffect(() => {
    if (!data || isLocked) return;
    if (
      areStringRecordsEqual(selected, savedSelected) &&
      areStringRecordsEqual(notes, savedNotes)
    ) {
      if (!hasConflict) {
        clearStoredJudgeDraft(draftStorageKey);
      }
      return;
    }
    writeStoredJudgeDraft(draftStorageKey, {
      baseVersionToken: versionToken,
      selected,
      notes,
    });
  }, [
    data,
    isLocked,
    selected,
    notes,
    savedSelected,
    savedNotes,
    versionToken,
    hasConflict,
    draftStorageKey,
  ]);

  const reloadFromServer = async () => {
    if (busy || isFetching) return;
    clearStoredJudgeDraft(draftStorageKey);
    seededProductIdRef.current = '';
    setError('');
    setHasConflict(false);
    const refreshed = await refetch();
    if (refreshed.data) {
      toast.info('Đã tải lại dữ liệu phiếu chấm mới nhất từ máy chủ.');
    }
  };

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
  const maxPossibleScore = subcriteria.reduce(
    (sum, sub) =>
      sum +
      Math.max(
        0,
        sub.options.reduce((maxPts, opt) => Math.max(maxPts, opt.points), 0),
      ),
    0,
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

  const buildScores = () => {
    const validSubIds = new Set(subcriteria.map((sub) => sub.id));
    return Object.entries(selected)
      .filter(([subCriterionId]) => validSubIds.has(subCriterionId))
      .map(([subCriterionId, optionId]) => ({
        subCriterionId,
        optionId,
        ...(notes[subCriterionId] ? { note: notes[subCriterionId] } : {}),
      }));
  };

  async function save() {
    if (!data || busy) return;
    setActiveAction('save');
    setError('');
    setNotice('');
    try {
      const { data: saved } = await judgeApi.save(productId, {
        scores: buildScores(),
        versionToken,
      });
      setSavedSelected(selected);
      setSavedNotes(notes);
      setVersionToken(saved.versionToken);
      setHasConflict(false);
      clearStoredJudgeDraft(draftStorageKey);
      setNotice('Đã lưu nháp lên máy chủ.');
      toast.success('Đã lưu nháp lên máy chủ.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.judge.queueAll });
    } catch (cause) {
      const msg = messageOf(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        setHasConflict(true);
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setActiveAction(null);
    }
  }

  function requestSubmit() {
    if (busy) return;
    setError('');
    setSubmitConfirmOpen(true);
  }

  async function submit() {
    if (busy) return;
    setActiveAction('submit');
    setError('');
    try {
      const { data: saved } = await judgeApi.save(productId, {
        scores: buildScores(),
        versionToken,
      });
      const { data: result } = await judgeApi.submit(productId, {
        versionToken: saved.versionToken,
      });
      setSavedSelected(selected);
      setSavedNotes(notes);
      setVersionToken(result.versionToken ?? saved.versionToken);
      setHasConflict(false);
      clearStoredJudgeDraft(draftStorageKey);
      setData((current) =>
        current
          ? {
              ...current,
              evaluation: {
                ...current.evaluation,
                status: result.status,
                total: result.total,
                versionToken: result.versionToken ?? saved.versionToken,
              },
            }
          : current,
      );
      setSubmitConfirmOpen(false);
      setNotice('Đã nộp phiếu chấm chính thức.');
      toast.success('Đã nộp phiếu chấm chính thức.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.judge.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    } catch (cause) {
      const msg = messageOf(cause);
      if (cause instanceof ApiError && cause.status === 409) {
        setHasConflict(true);
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setActiveAction(null);
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

  const isExcluded = data.evaluation.status === EVALUATION_STATUS.EXCLUDED;
  const locked = data.evaluation.status === EVALUATION_STATUS.SUBMITTED || isExcluded;
  const [entityEntries, productEntries] = partitionFormEntries(data.product.formData);
  const imageAttachments = data.product.attachments.filter(
    (item) => item.type === ATTACHMENT_TYPE.IMAGE,
  );
  const documentAttachments = data.product.attachments.filter(
    (item) => item.type !== ATTACHMENT_TYPE.IMAGE,
  );
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
            className={
              isExcluded
                ? 'status-badge status-draft'
                : locked
                  ? 'status-badge status-completed'
                  : 'status-badge status-scoring'
            }
          >
            {isExcluded ? 'Đã gỡ khỏi hồ sơ · chỉ đọc' : locked ? 'Đã nộp · chỉ đọc' : 'Đang chấm'}
          </Badge>
        }
        description={
          <>
            {data.product.category.name} · Mã hồ sơ{' '}
            <span title={data.product.id}>{displayProductCode(data.product)}</span>
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
      {locked && (
        <p className='form-note'>
          {isExcluded
            ? 'Bạn đã được gỡ khỏi phân công của hồ sơ này. Phiếu chấm được lưu lịch sử ở chế độ chỉ đọc.'
            : 'Phiếu đã nộp và không thể chỉnh sửa.'}
        </p>
      )}
      <div className='judge-workspace' ref={workspaceRef} style={containerStyle}>
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
          {sectionGroups.map((section) => (
            <div className='criteria-nav-group' key={section.key}>
              <h2>{section.label}</h2>
              {section.items.map((criterion) => {
                const selectedCount = criterion.subCriteria.filter((sub) =>
                  Boolean(selected[sub.id]),
                ).length;
                const done =
                  criterion.subCriteria.length > 0 &&
                  selectedCount === criterion.subCriteria.length;
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
                        {done && <Check className='text-accent size-3.5' aria-hidden='true' />}
                        <span>
                          {selectedCount}/{criterion.subCriteria.length} mục
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        <ColumnResizeHandle {...getHandleProps('left')} className='judge-resize-handle is-left' />
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
              {activeCriterion.subCriteria.map((sub, subIndex) => {
                const subCode = sub.code?.trim() || `${activeCriterion.code}.${subIndex + 1}`;
                return (
                  <fieldset className='score-card' key={sub.id} disabled={locked || busy}>
                    <legend
                      className={activeCriterion.subCriteria.length === 1 ? 'sr-only' : undefined}
                    >
                      {subCode}. {sub.content}
                    </legend>
                    <RadioGroup
                      className='score-options'
                      value={selected[sub.id] ?? ''}
                      disabled={locked || busy}
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
                            <RadioGroupItem
                              value={option.id}
                              id={optionInputId}
                              onClick={(event) => {
                                if (locked || busy || selected[sub.id] !== option.id) return;
                                event.preventDefault();
                                setSelected((current) => {
                                  const next = { ...current };
                                  delete next[sub.id];
                                  return next;
                                });
                                setNotice('');
                                setError('');
                              }}
                            />
                            <Label
                              htmlFor={optionInputId}
                              className='cursor-pointer leading-normal font-normal text-black after:absolute after:inset-0'
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
                          disabled={locked || busy}
                          value={notes[sub.id] ?? ''}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setNotes((current) => {
                              const next = { ...current };
                              if (nextValue) next[sub.id] = nextValue;
                              else delete next[sub.id];
                              return next;
                            });
                            setNotice('');
                          }}
                        />
                      </details>
                    )}
                  </fieldset>
                );
              })}
            </div>
          ) : (
            <div className='empty-state'>
              <p>Chưa có tiêu chí nào được phân công cho phiếu này.</p>
            </div>
          )}
          <div className='judge-criterion-nav'>
            <Button
              variant='secondary'
              disabled={busy || activeIndex <= 0}
              onClick={() => setActiveCriterionId(data.criteria[activeIndex - 1]?.id ?? '')}
            >
              ← Tiêu chí trước
            </Button>
            <span>
              {completed}/{subcriteria.length} tiểu tiêu chí đã chọn
            </span>
            <Button
              variant='secondary'
              disabled={busy || activeIndex < 0 || activeIndex >= data.criteria.length - 1}
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
              {error && !submitConfirmOpen && (
                <div className='space-y-2'>
                  <AlertError title='Không thể lưu hoặc nộp phiếu chấm' errors={[error]} />
                  {hasConflict && (
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      loading={isFetching}
                      disabled={busy || isFetching}
                      onClick={() => void reloadFromServer()}
                    >
                      Tải lại dữ liệu mới nhất
                    </Button>
                  )}
                </div>
              )}
              <div className='judge-submit-actions'>
                <Button
                  variant='secondary'
                  loading={activeAction === 'save'}
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {activeAction === 'save' ? 'Đang lưu…' : 'Lưu nháp'}
                </Button>
                <Button
                  loading={activeAction === 'submit'}
                  disabled={busy || !data.criteria.length}
                  onClick={requestSubmit}
                >
                  {activeAction === 'submit' ? 'Đang nộp…' : 'Nộp phiếu chấm'}
                </Button>
              </div>
            </footer>
          )}
        </main>
        <ColumnResizeHandle {...getHandleProps('right')} className='judge-resize-handle is-right' />
        <aside className='judge-evidence-panel' aria-label='Thông tin sản phẩm và minh chứng'>
          <h2>Minh chứng hồ sơ</h2>
          {imageAttachments.length ? (
            <div className='evidence-gallery'>
              {imageAttachments.map((file, idx) => (
                <button
                  type='button'
                  className='evidence-thumb cursor-zoom-in'
                  key={file.id}
                  onClick={() => setPreviewImageIndex(idx)}
                  aria-label={`Xem phóng to ảnh ${file.fileName}`}
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
                      onClick={() =>
                        void openProductAttachmentByMode(
                          'judge',
                          productId,
                          file.id,
                          file.fileName,
                          false,
                        )
                      }
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
        <div ref={ghostRef} className='column-resize-ghost' aria-hidden='true' />
      </div>
      <ImagePreviewDialog
        items={imageAttachments.map((file) => ({
          kind: 'private',
          id: file.id,
          name: file.fileName,
          mode: 'judge',
          productId,
        }))}
        activeIndex={previewImageIndex}
        onIndexChange={setPreviewImageIndex}
        contextLabel={`Hồ sơ: ${data.product.name}`}
      />
      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setSubmitConfirmOpen(false);
        }}
        title='Nộp phiếu chấm?'
        description='Sau khi nộp, phiếu chấm sẽ được chốt điểm và chuyển sang chế độ chỉ đọc.'
        confirmLabel='Xác nhận nộp phiếu'
        pending={activeAction === 'submit'}
        error={error}
        onConfirm={() => void submit()}
      />
    </PageContainer>
  );
}
