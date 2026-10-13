import { useEffect, useMemo, useState } from "react";
import { records } from "./data";
import { allJudgeCriteria, criterionOneSubcriteria, initialJudgeDraft, judgeSections, type JudgeCriterion, type JudgeDraft, type Subcriterion } from "./judgeData";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isRecord } from "@/lib/utils";

const dossier = records.find((record) => record.id === "HS-26-0012");
const storageKey = "ocop-judge-demo-HS-26-0012";

function freshDraft(): JudgeDraft {
  return {
    activeCriterion: initialJudgeDraft.activeCriterion,
    scores: { ...initialJudgeDraft.scores },
    selectedOptions: { ...initialJudgeDraft.selectedOptions },
    notes: {},
  };
}

function loadDraft(): JudgeDraft {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (!isRecord(parsed) || !isRecord(parsed.scores) || !isRecord(parsed.selectedOptions)) return freshDraft();

    const scores: Record<number, number> = {};
    for (const [rawId, score] of Object.entries(parsed.scores)) {
      const id = Number(rawId);
      const criterion = allJudgeCriteria.find((item) => item.id === id);
      if (criterion && typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= criterion.maxScore) {
        scores[id] = score;
      }
    }

    const selectedOptions: Record<string, number> = {};
    for (const [id, score] of Object.entries(parsed.selectedOptions)) {
      if (typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 10) selectedOptions[id] = score;
    }

    const notes: Record<string, string> = {};
    if (isRecord(parsed.notes)) {
      for (const [id, note] of Object.entries(parsed.notes)) {
        if (typeof note === "string") notes[id] = note.slice(0, 2000);
      }
    }

    const candidateCriterion = parsed.activeCriterion;
    const activeCriterion = typeof candidateCriterion === "number" && allJudgeCriteria.some((criterion) => criterion.id === candidateCriterion)
      ? candidateCriterion
      : 1;
    return { activeCriterion, scores, selectedOptions, notes };
  } catch {
    return freshDraft();
  }
}

function timeLabel(): string {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function genericSubcriterion(criterion: JudgeCriterion): Subcriterion {
  const middle = Math.max(1, Math.round(criterion.maxScore / 2));
  return {
    id: `criterion-${criterion.id}`,
    title: `Mức đáp ứng của tiêu chí ${criterion.id} · minh họa`,
    maxScore: criterion.maxScore,
    options: [
      { points: 0, label: "Chưa có minh chứng đáp ứng" },
      { points: middle, label: "Đáp ứng một phần yêu cầu" },
      { points: criterion.maxScore, label: "Đáp ứng đầy đủ yêu cầu" },
    ],
  };
}

function StatusMark({ done }: { done: boolean }) {
  return done ? (
    <svg className="judge-status-mark is-done" viewBox="0 0 20 20" aria-label="Đã chấm">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="m5.7 10.2 2.7 2.6 5.9-6" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : <span className="judge-status-mark" role="img" aria-label="Chưa chấm" />;
}

type NavIconKind = "queue" | "done" | "account";

function NavIcon({ kind }: { kind: NavIconKind }) {
  const paths = {
    queue: <><path d="M5 4.5h14v15H5z" /><path d="M8 9h8M8 12h8M8 15h5M3 7v14h14" /></>,
    done: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

function FileIcon({ kind }: { kind: "PDF" | "IMG" }) {
  return (
    <span className={`judge-file-icon ${kind === "PDF" ? "is-pdf" : "is-image"}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M14 3.5v5h5M8 13h8M8 16h6" />
      </svg>
      <small>{kind}</small>
    </span>
  );
}

interface JudgeScoringProps {
  onHome: () => void;
}

export function JudgeScoring({ onHome }: JudgeScoringProps) {
  const [draft, setDraft] = useState<JudgeDraft>(loadDraft);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState("10:42");
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const criteria = useMemo(() => judgeSections.flatMap((section) => section.criteria), []);
  const activeCriterion = criteria.find((criterion) => criterion.id === draft.activeCriterion) ?? criteria[0];
  const subcriteria = activeCriterion.id === 1 ? criterionOneSubcriteria : [genericSubcriterion(activeCriterion)];
  const doneCount = criteria.filter((criterion) => draft.scores[criterion.id] !== undefined).length;
  const totalScore = Object.values(draft.scores).reduce((sum, score) => sum + score, 0);

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt(timeLabel());
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft]);

  function updateScore(subcriterion: Subcriterion, points: number): void {
    setDraft((current) => {
      const selectedOptions = { ...current.selectedOptions, [subcriterion.id]: points };
      const score = subcriteria.reduce((sum, item) => sum + (selectedOptions[item.id] ?? 0), 0);
      return {
        ...current,
        scores: { ...current.scores, [activeCriterion.id]: score },
        selectedOptions,
      };
    });
    setNotice("");
  }

  function updateNote(subcriterionId: string, note: string): void {
    setDraft((current) => ({ ...current, notes: { ...current.notes, [subcriterionId]: note.slice(0, 2000) } }));
  }

  function saveNow(): void {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt(timeLabel());
      setSaveState("saved");
      setNotice("Bản nháp mẫu đã được lưu trên trình duyệt này.");
    } catch {
      setSaveState("error");
      setNotice("Không thể lưu trên trình duyệt này. Hãy thử lại sau.");
    }
  }

  function submitSample(): void {
    if (doneCount < criteria.length) {
      setNotice(`Còn ${criteria.length - doneCount} tiêu chí chưa chấm. Hoàn tất trước khi nộp phiếu.`);
      return;
    }
    setSubmitted(true);
    setNotice("Phiếu chấm mẫu đã được ghi nhận trên trình duyệt này.");
  }

  return (
    <div className="judge-app">
      <a className="judge-skip-link" href="#judge-content">Bỏ qua điều hướng</a>
      <div className="judge-shell">
        <aside className="judge-sidebar" aria-label="Điều hướng giám khảo">
          <a className="judge-brand" href="/" onClick={(event) => { event.preventDefault(); onHome(); }}>
            <span className="judge-brand-mark" aria-hidden="true">O</span>
            <span><strong>OCOP Đánh Giá</strong><small>Không gian giám khảo</small></span>
          </a>
          <nav className="judge-side-nav">
            <button type="button" className="is-active" aria-current="page"><NavIcon kind="queue" /><span>Hàng chờ chấm</span></button>
            <button type="button" disabled><NavIcon kind="done" /><span>Đã chấm</span><small>Sắp có</small></button>
            <button type="button" disabled><NavIcon kind="account" /><span>Tài khoản</span><small>Sắp có</small></button>
          </nav>
          <div className="judge-sidebar-foot"><span className="judge-online-dot" /> Bản mẫu · dữ liệu cục bộ</div>
        </aside>

        <div className="judge-main">
          <header className="judge-topbar">
            <div className="judge-breadcrumb"><span>Hàng chờ chấm</span><span aria-hidden="true">/</span><strong>Phiếu chấm</strong></div>
            <div className="judge-user"><span className="judge-avatar" aria-hidden="true">GK</span><span><strong>Giám khảo</strong><small>Tài khoản mẫu</small></span></div>
          </header>

          <main className="judge-content" id="judge-content">
            <div className="judge-page-heading">
              <div><p className="judge-eyebrow">PHIẾU ĐÁNH GIÁ · DỮ LIỆU MINH HỌA</p><h1>Chấm điểm sản phẩm</h1><p>Chọn mức đáp ứng cho từng tiêu chí, ghi chú khi cần và lưu tiến độ.</p></div>
              <div className="judge-dossier-chip"><span>Mã hồ sơ</span><strong>{dossier?.id ?? "HS-26-0012"}</strong></div>
            </div>

            <div className="judge-demo-note" role="note">
              <span aria-hidden="true">i</span>
              <p>Rubric ngoài các mức điểm được cung cấp là dữ liệu minh họa. Hãy nạp bộ tiêu chí đúng nhóm sản phẩm trước khi dùng để chấm thật.</p>
            </div>

            <div className="judge-workspace">
              <aside className="judge-criteria-panel" aria-label="Danh sách tiêu chí">
                <div className="judge-progress-head"><div><strong>Tiến độ chấm</strong><span>{doneCount}/26 tiêu chí đã chấm</span></div><strong className="judge-progress-value">{Math.round(doneCount / 26 * 100)}%</strong></div>
                <div className="judge-progress-track" role="progressbar" aria-label="Tiến độ tiêu chí đã chấm" aria-valuemin={0} aria-valuemax={26} aria-valuenow={doneCount}><span style={{ width: `${doneCount / 26 * 100}%` }} /></div>
                {judgeSections.map((section) => (
                  <section className="judge-criteria-group" key={section.id} aria-labelledby={`judge-group-${section.id}`}>
                    <div className="judge-group-heading"><h2 id={`judge-group-${section.id}`}>{section.id}. {section.label}</h2><span>{section.maxScore} điểm</span></div>
                    <div className="judge-criteria-list">
                      {section.criteria.map((criterion) => {
                        const done = draft.scores[criterion.id] !== undefined;
                        const active = draft.activeCriterion === criterion.id;
                        return (
                          <button key={criterion.id} type="button" className={`judge-criterion${active ? " is-active" : ""}`} aria-current={active ? "step" : undefined} onClick={() => { setDraft((current) => ({ ...current, activeCriterion: criterion.id })); setNotice(""); }} disabled={submitted}>
                            <span className="judge-criterion-number">{criterion.id}.</span>
                            <span className="judge-criterion-name">{criterion.name}</span>
                            <span className={done ? "judge-score-chip" : "judge-score-chip is-empty"}>{done ? `${draft.scores[criterion.id]}/${criterion.maxScore}` : "Chưa chấm"}</span>
                            <StatusMark done={done} />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </aside>

              <section className="judge-scoring-panel" aria-labelledby="judge-active-title">
                <div className="judge-active-header">
                  <div><p className="judge-eyebrow">TIÊU CHÍ {activeCriterion.id} · NHÓM {judgeSections.find((section) => section.criteria.some((item) => item.id === activeCriterion.id))?.id}</p><h2 id="judge-active-title">{activeCriterion.name}</h2></div>
                  <span className="judge-max-score">Tối đa {activeCriterion.maxScore} điểm</span>
                </div>
                <div className="judge-subcriteria-list">
                  {subcriteria.map((subcriterion, index) => (
                    <Card as="article" className="judge-subcriterion" key={subcriterion.id}>
                      <fieldset className="judge-score-fieldset" disabled={submitted}>
                        <legend><span>{String(index + 1).padStart(2, "0")}</span>{subcriterion.title}</legend>
                        <div className="judge-score-options">
                          {subcriterion.options.map((option) => (
                            <label className="judge-score-option" key={`${subcriterion.id}-${option.points}`}>
                              <input type="radio" name={`score-${subcriterion.id}`} value={option.points} checked={draft.selectedOptions[subcriterion.id] === option.points} onChange={() => updateScore(subcriterion, option.points)} />
                              <span className="judge-option-label">{option.label}</span>
                              <strong className="judge-option-points">{option.points} điểm</strong>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <details className="judge-note-disclosure">
                        <summary>Ghi chú của giám khảo <span aria-hidden="true">⌄</span></summary>
                        <label className="judge-note-label" htmlFor={`note-${subcriterion.id}`}>Ghi chú cho mục: {subcriterion.title}</label>
                        <textarea id={`note-${subcriterion.id}`} rows={3} maxLength={2000} value={draft.notes[subcriterion.id] ?? ""} onChange={(event) => updateNote(subcriterion.id, event.target.value)} disabled={submitted} placeholder="Ghi căn cứ hoặc nhận xét ngắn…" />
                      </details>
                    </Card>
                  ))}
                </div>
                <div className="judge-step-nav">
                  <Button type="button" variant="judgeSecondary" onClick={() => setDraft((current) => ({ ...current, activeCriterion: Math.max(1, current.activeCriterion - 1) }))} disabled={activeCriterion.id === 1 || submitted}>← Tiêu chí trước</Button>
                  <span>{activeCriterion.id} / 26</span>
                  <Button type="button" variant="judgeSecondary" onClick={() => setDraft((current) => ({ ...current, activeCriterion: Math.min(26, current.activeCriterion + 1) }))} disabled={activeCriterion.id === 26 || submitted}>Tiêu chí tiếp theo →</Button>
                </div>
              </section>

              <aside className="judge-evidence-panel" aria-labelledby="judge-evidence-title">
                <div className="judge-evidence-heading"><div><p className="judge-eyebrow">HỒ SƠ ĐƯỢC GIAO</p><h2 id="judge-evidence-title">Minh chứng sản phẩm</h2></div><span className="judge-sample-pill">Mẫu</span></div>
                {dossier && <figure className="judge-product-figure">
                  <div className="judge-product-photo"><img src={dossier.image} alt={dossier.alt} width={600} height={450} /></div>
                  <figcaption><span>Ảnh sản phẩm · 1 ảnh</span><button type="button" className="judge-photo-thumb" aria-label="Ảnh sản phẩm đang chọn"><img src={dossier.image} alt="" width={600} height={450} /></button></figcaption>
                </figure>}
                <div className="judge-product-summary"><h3>Mật ong rừng U Minh</h3><p>Thực phẩm <span aria-hidden="true">·</span> Cà Mau</p><dl><div><dt>Chủ thể</dt><dd>HTX Nông nghiệp Minh Hải</dd></div><div><dt>Mã hồ sơ</dt><dd>{dossier?.id ?? "HS-26-0012"}</dd></div></dl></div>
                <details className="judge-evidence-section" open>
                  <summary>Thông tin chủ thể <span aria-hidden="true">⌄</span></summary>
                  <dl><div><dt>Tên chủ thể</dt><dd>HTX Nông nghiệp Minh Hải</dd></div><div><dt>Địa phương</dt><dd>Cà Mau</dd></div></dl>
                </details>
                <details className="judge-evidence-section">
                  <summary>Thông tin sản phẩm <span aria-hidden="true">⌄</span></summary>
                  <dl><div><dt>Tên sản phẩm</dt><dd>Mật ong rừng U Minh</dd></div><div><dt>Nhóm sản phẩm</dt><dd>Thực phẩm</dd></div><div><dt>Mã hồ sơ</dt><dd>{dossier?.id ?? "HS-26-0012"}</dd></div></dl>
                </details>
                <div className="judge-attachments"><h3>Tệp minh chứng <span>2</span></h3><ul>
                  <li><FileIcon kind="PDF" /><span>Giấy chứng nhận ATTP.pdf<small>PDF · tên tệp mẫu</small></span></li>
                  <li><FileIcon kind="PDF" /><span>Phiếu kiểm nghiệm.pdf<small>PDF · tên tệp mẫu</small></span></li>
                </ul></div>
                <p className="judge-evidence-disclaimer">Thông tin và tệp đính kèm trên màn hình là dữ liệu minh họa.</p>
              </aside>
            </div>
          </main>
        </div>
      </div>

      <footer className="judge-scorebar" aria-label="Tổng điểm và thao tác phiếu chấm">
        <div className="judge-score-total" aria-live="polite"><strong>{totalScore}</strong><span>/100 điểm</span><span className="judge-star-preview"><span aria-hidden="true">★★★★☆</span>Dự kiến 4 sao <small>mẫu</small></span></div>
        <div className="judge-save-status" role="status"><span className={`judge-save-dot is-${saveState}`} />{saveState === "saving" ? "Đang lưu nháp…" : saveState === "error" ? "Chưa lưu được" : `Đã lưu nháp lúc ${savedAt}`}</div>
        <div className="judge-actions"><Button type="button" variant="judgeSecondary" onClick={saveNow} disabled={submitted}>Lưu nháp</Button><Button type="button" variant="judgePrimary" onClick={submitSample} disabled={submitted}>{submitted ? "Đã nộp phiếu mẫu" : "Nộp phiếu chấm"}</Button></div>
        {notice && <p className="judge-action-notice" role={doneCount < 26 && notice.startsWith("Còn ") ? "alert" : "status"}>{notice}</p>}
      </footer>
    </div>
  );
}
