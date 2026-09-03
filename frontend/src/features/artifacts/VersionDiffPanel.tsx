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

const metadataLabel: Record<string, string> = {
  title: "문서 제목",
  description: "설명",
  artifact_type: "문서 종류",
  tags: "태그",
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

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void api
      .get<VersionResponse[]>(
        `/projects/${projectId}/artifacts/${artifactId}/versions`,
        controller.signal,
      )
      .then((items) => {
        const ordered = [...items].sort((a, b) => b.version_number - a.version_number);
        setVersions(ordered);
        setSelected(ordered[0]?.version_id ?? "");
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
        <div className="diff-heading">
          <p>문서 변경 확인</p>
          <h2>이전 버전과 현재 내용 비교</h2>
          <span>확정해 둔 이전 버전을 선택하면 현재 편집 내용과 나란히 보여줍니다.</span>
        </div>
        <div className="diff-actions">
          <label>
            <span>비교할 이전 버전</span>
            <select
              aria-label="비교할 이전 버전"
              data-testid="diff-right-select"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={!versions.length}
            >
              <option value="">이전 버전 선택</option>
              {versions.map((version) => (
                <option key={version.version_id} value={version.version_id}>
                  버전 {version.version_number} · {version.change_summary || "변경 내용 미입력"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            data-testid="diff-run-button"
            disabled={!selected || loading}
            onClick={() => void compare()}
          >
            {loading ? "비교하는 중…" : "현재 내용과 비교"}
          </button>
        </div>
      </header>

      <SafeFeedback problem={problem} />

      {result ? (
        <div className="diff-editor" aria-label="diff 결과">
          <div className="diff-editor-tabs">
            <div>
              <span className="version-dot" />
              버전 {selectedVersion?.version_number ?? "-"} · 이전 내용
            </div>
            <div>
              <span className="draft-dot" />
              현재 편집 내용
            </div>
          </div>
          <div className="diff-summary" aria-label="변경 요약">
            <span className="added">추가 {result.summary.added}줄</span>
            <span className="removed">삭제 {result.summary.removed}줄</span>
            <span>동일 {result.summary.unchanged}줄</span>
          </div>
          {result.metadata_changes.length ? (
            <div className="metadata-diff">
              {result.metadata_changes.map((change) => (
                <div key={change.field}>
                  <strong>{metadataLabel[change.field] ?? change.field}</strong>
                  <del>{String(change.before)}</del>
                  <ins>{String(change.after)}</ins>
                </div>
              ))}
            </div>
          ) : null}
          <div className="diff-columns">
            <div className="diff-column-head">
              이전 버전 {selectedVersion?.version_number ?? "-"}
            </div>
            <div className="diff-column-head">현재 편집 내용</div>
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
          <strong>비교할 이전 버전을 선택하세요</strong>
          <span>선택한 이전 버전과 현재 편집 내용을 나란히 확인할 수 있습니다.</span>
        </div>
      )}
    </section>
  );
}
