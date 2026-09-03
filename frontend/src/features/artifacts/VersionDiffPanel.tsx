import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type DiffResult, type VersionResponse } from "../../shared/api/models";
import { SafeFeedback } from "../../shared/ui/SafeFeedback";

type Props = { api: ApiClient; projectId: string; artifactId: string };
type DiffRow = {
  leftNumber: number | null;
  rightNumber: number | null;
  left: string;
  right: string;
  kind: "added" | "removed" | "unchanged" | "modified";
};

const rowsOf = (result: DiffResult): DiffRow[] => {
  const rows: DiffRow[] = [];
  let leftNumber = 1;
  let rightNumber = 1;
  for (let hunkIndex = 0; hunkIndex < result.body_hunks.length; hunkIndex += 1) {
    const hunk = result.body_hunks[hunkIndex];
    const next = result.body_hunks[hunkIndex + 1];
    if (hunk.kind === "removed" && next?.kind === "added") {
      const count = Math.max(hunk.before.length, next.after.length);
      for (let index = 0; index < count; index += 1) {
        const left = hunk.before[index] ?? "";
        const right = next.after[index] ?? "";
        rows.push({
          leftNumber: left ? leftNumber++ : null,
          rightNumber: right ? rightNumber++ : null,
          left,
          right,
          kind: "modified",
        });
      }
      hunkIndex += 1;
      continue;
    }
    if (hunk.kind === "unchanged") {
      const count = Math.max(hunk.before.length, hunk.after.length);
      for (let index = 0; index < count; index += 1) {
        rows.push({
          leftNumber: leftNumber++,
          rightNumber: rightNumber++,
          left: hunk.before[index] ?? "",
          right: hunk.after[index] ?? "",
          kind: "unchanged",
        });
      }
    }
    if (hunk.kind === "removed") {
      for (const line of hunk.before) {
        rows.push({
          leftNumber: leftNumber++,
          rightNumber: null,
          left: line,
          right: "",
          kind: "removed",
        });
      }
    }
    if (hunk.kind === "added") {
      for (const line of hunk.after) {
        rows.push({
          leftNumber: null,
          rightNumber: rightNumber++,
          left: "",
          right: line,
          kind: "added",
        });
      }
    }
  }
  return rows;
};

export function VersionDiffPanel({ api, projectId, artifactId }: Props) {
  const [versions, setVersions] = useState<VersionResponse[]>([]);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<DiffResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const ready = Boolean(projectId && artifactId);
  const rows = useMemo(() => (result ? rowsOf(result) : []), [result]);

  const fail = (error: unknown) =>
    setProblem(
      error instanceof ApiProblem
        ? error
        : new ApiProblem({
            code: "NETWORK_ERROR",
            message: "버전 요청에 실패했습니다.",
            retryable: true,
          }),
    );

  const load = async () => {
    if (!ready) return;
    try {
      setProblem(null);
      const items = await api.get<VersionResponse[]>(
        `/projects/${projectId}/artifacts/${artifactId}/versions`,
      );
      setVersions(items);
      setSelected((current) => current || items.at(-1)?.version_id || "");
    } catch (error) {
      fail(error);
    }
  };

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void api
      .get<VersionResponse[]>(
        `/projects/${projectId}/artifacts/${artifactId}/versions`,
        controller.signal,
      )
      .then((items) => {
        setVersions(items);
        setSelected(items.at(-1)?.version_id ?? "");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "NETWORK_ERROR",
                message: "버전 요청에 실패했습니다.",
                retryable: true,
              }),
        );
      });
    return () => controller.abort();
  }, [api, projectId, artifactId, ready]);

  const compare = async () => {
    if (!selected) return;
    setLoading(true);
    setMessage("");
    try {
      setProblem(null);
      setResult(
        await api.post<DiffResult>(`/projects/${projectId}/artifacts/${artifactId}/diff`, {
          left: { kind: "version", version_id: selected },
          right: { kind: "draft" },
        }),
      );
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedVersion = versions.find((version) => version.version_id === selected);

  return (
    <section className="version-diff-panel">
      <header className="diff-toolbar">
        <div>
          <p>VERSION CONTROL</p>
          <h2>변경 내용 비교</h2>
        </div>
        <div className="diff-actions">
          <button data-testid="version-list" disabled={!ready} onClick={() => void load()}>
            새로고침
          </button>
          <select
            aria-label="기준 버전"
            data-testid="diff-right-select"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={!versions.length}
          >
            <option value="">기준 버전 선택</option>
            {versions.map((version) => (
              <option key={version.version_id} value={version.version_id}>
                v{version.version_number} · revision {version.source_draft_revision}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            data-testid="diff-run-button"
            disabled={!selected || loading}
            onClick={() => void compare()}
          >
            {loading ? "비교 중…" : "Draft와 비교"}
          </button>
        </div>
      </header>

      {message ? <p className="diff-message">{message}</p> : null}
      <SafeFeedback problem={problem} />

      {result ? (
        <div className="diff-editor" aria-label="diff 결과">
          <div className="diff-editor-tabs">
            <div>
              <span className="version-dot" />v{selectedVersion?.version_number ?? "-"} · 기준 버전
            </div>
            <div>
              <span className="draft-dot" />
              현재 Draft
            </div>
          </div>
          <div className="diff-summary">
            <span className="added">+{result.summary.added}</span>
            <span className="removed">-{result.summary.removed}</span>
            <span>{result.summary.unchanged} unchanged</span>
          </div>
          {result.metadata_changes.length ? (
            <div className="metadata-diff">
              {result.metadata_changes.map((change) => (
                <div key={change.field}>
                  <strong>{change.field}</strong>
                  <del>{String(change.before)}</del>
                  <ins>{String(change.after)}</ins>
                </div>
              ))}
            </div>
          ) : null}
          <div className="diff-columns">
            <div className="diff-column-head">v{selectedVersion?.version_number ?? "-"}</div>
            <div className="diff-column-head">Draft</div>
            {rows.map((row, index) => (
              <div className="diff-row" key={`${index}-${row.leftNumber}-${row.rightNumber}`}>
                <div
                  className={`diff-line left ${row.kind === "removed" || row.kind === "modified" ? "removed" : row.kind === "added" ? "blank" : ""}`}
                >
                  <span className="line-number">{row.leftNumber ?? ""}</span>
                  <span className="change-marker">
                    {row.kind === "removed" || row.kind === "modified" ? "−" : " "}
                  </span>
                  <code>{row.left || " "}</code>
                </div>
                <div
                  className={`diff-line right ${row.kind === "added" || row.kind === "modified" ? "added" : row.kind === "removed" ? "blank" : ""}`}
                >
                  <span className="line-number">{row.rightNumber ?? ""}</span>
                  <span className="change-marker">
                    {row.kind === "added" || row.kind === "modified" ? "+" : " "}
                  </span>
                  <code>{row.right || " "}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="diff-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3 4 7l4 4M4 7h10a4 4 0 0 1 4 4v1M16 21l4-4-4-4M20 17H10a4 4 0 0 1-4-4v-1" />
          </svg>
          <strong>비교할 버전을 선택하세요</strong>
          <span>기준 버전은 왼쪽, 현재 Draft는 오른쪽에 표시됩니다.</span>
        </div>
      )}
    </section>
  );
}
