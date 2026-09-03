import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type DiffResult, type VersionResponse } from "../../shared/api/models";
import { SafeFeedback } from "../../shared/ui/SafeFeedback";

type Row = { left: string; right: string; kind: "same" | "added" | "removed" | "changed" };

const diffRows = (result: DiffResult | null): Row[] => {
  if (!result) return [];
  const rows: Row[] = [];
  for (let index = 0; index < result.body_hunks.length; index += 1) {
    const hunk = result.body_hunks[index];
    const next = result.body_hunks[index + 1];
    if (hunk.kind === "removed" && next?.kind === "added") {
      const count = Math.max(hunk.before.length, next.after.length);
      for (let line = 0; line < count; line += 1) {
        rows.push({
          left: hunk.before[line] ?? "",
          right: next.after[line] ?? "",
          kind: "changed",
        });
      }
      index += 1;
    } else if (hunk.kind === "removed") {
      hunk.before.forEach((line) => rows.push({ left: line, right: "", kind: "removed" }));
    } else if (hunk.kind === "added") {
      hunk.after.forEach((line) => rows.push({ left: "", right: line, kind: "added" }));
    } else {
      hunk.before.forEach((line, lineIndex) =>
        rows.push({ left: line, right: hunk.after[lineIndex] ?? line, kind: "same" }),
      );
    }
  }
  return rows;
};

export function VersionCreationModal({
  open,
  api,
  projectId,
  artifactId,
  onClose,
  onCreated,
}: {
  open: boolean;
  api: ApiClient;
  projectId: string;
  artifactId: string;
  onClose: () => void;
  onCreated: (version: VersionResponse) => void;
}) {
  const [baseline, setBaseline] = useState<VersionResponse | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const rows = useMemo(() => diffRows(diff), [diff]);

  useEffect(() => {
    if (!open) return;
    void api
      .get<VersionResponse[]>(`/projects/${projectId}/artifacts/${artifactId}/versions`)
      .then(async (versions) => {
        const latest = [...versions].sort((a, b) => b.version_number - a.version_number)[0] ?? null;
        setBaseline(latest);
        if (latest) {
          setDiff(
            await api.post<DiffResult>(`/projects/${projectId}/artifacts/${artifactId}/diff`, {
              left: { kind: "version", version_id: latest.version_id },
              right: { kind: "draft" },
            }),
          );
        }
      })
      .catch((error) =>
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "VERSION_PREVIEW_FAILED",
                message: "변경 내역을 불러오지 못했습니다.",
                retryable: true,
              }),
        ),
      )
      .finally(() => setLoading(false));
  }, [open, api, projectId, artifactId]);

  if (!open) return null;

  const createVersion = async () => {
    if (!message.trim()) return;
    setCreating(true);
    setProblem(null);
    try {
      const version = await api.post<VersionResponse>(
        `/projects/${projectId}/artifacts/${artifactId}/versions`,
        { change_summary: message.trim() },
      );
      onCreated(version);
      onClose();
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "VERSION_CREATE_FAILED",
              message: "새 버전을 생성하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="version-modal-backdrop" onMouseDown={onClose}>
      <section
        className="version-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>VERSION CONTROL</p>
            <h2 id="version-modal-title">새 버전 생성</h2>
            <span>
              {baseline
                ? `v${baseline.version_number} 이후 변경사항을 확인합니다.`
                : "첫 번째 버전을 생성합니다."}
            </span>
          </div>
          <button onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="version-modal-body">
          {loading ? (
            <div className="version-diff-loading">변경 내역을 계산하는 중입니다…</div>
          ) : null}
          {!loading && !baseline ? (
            <div className="first-version-note">
              기존 버전이 없습니다. 현재 임시저장 내용을 v1으로 생성합니다.
            </div>
          ) : null}
          {diff ? (
            <div className="version-preview-diff">
              <div className="version-preview-summary">
                <strong>변경 내용</strong>
                <span className="added">+{diff.summary.added}</span>
                <span className="removed">-{diff.summary.removed}</span>
              </div>
              <div className="version-preview-head">
                <span>v{baseline?.version_number}</span>
                <span>현재 임시저장</span>
              </div>
              <div className="version-preview-lines">
                {rows.map((row, index) => (
                  <div className="version-preview-row" key={index}>
                    <code
                      className={row.kind === "removed" || row.kind === "changed" ? "removed" : ""}
                    >
                      {row.left || " "}
                    </code>
                    <code className={row.kind === "added" || row.kind === "changed" ? "added" : ""}>
                      {row.right || " "}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <label className="version-message-field">
            <span>수정 메시지</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="이번 버전에서 변경된 내용을 설명하세요."
              maxLength={2000}
            />
          </label>
          <SafeFeedback problem={problem} />
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button
            className="primary-button"
            disabled={!message.trim() || loading || creating}
            onClick={() => void createVersion()}
          >
            {creating ? "생성 중…" : `v${(baseline?.version_number ?? 0) + 1} 생성`}
          </button>
        </footer>
      </section>
    </div>
  );
}
