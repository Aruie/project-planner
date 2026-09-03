import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem } from "../../shared/api/models";
import { SafeFeedback } from "../../shared/ui/SafeFeedback";

type TraceLinkResponse = {
  trace_link_id: string;
  requirement_id: string;
  test_case_id: string;
  status: string;
};

type TraceGapResult = {
  story_ids: string[];
  requirement_ids: string[];
  test_case_ids: string[];
};

export function TraceabilityPanel({
  api,
  projectId,
  requirementIds,
}: {
  api: ApiClient;
  projectId: string;
  requirementIds: string[];
}) {
  const [requirement, setRequirement] = useState(requirementIds[0] ?? "");
  const [story, setStory] = useState("");
  const [testCase, setTestCase] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<TraceLinkResponse | null>(null);
  const [gaps, setGaps] = useState<TraceGapResult | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const selectedRequirement = requirement || requirementIds[0] || "";

  const fail = (error: unknown, message: string) =>
    setProblem(
      error instanceof ApiProblem
        ? error
        : new ApiProblem({ code: "NETWORK_ERROR", message, retryable: true }),
    );

  const create = async () => {
    if (!projectId || !selectedRequirement.trim() || !testCase.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      const data = await api.post<TraceLinkResponse>(`/projects/${projectId}/trace-links`, {
        story_id: story.trim() || selectedRequirement.trim(),
        requirement_id: selectedRequirement.trim(),
        test_case_id: testCase.trim(),
        status: "connected",
      });
      setSaved(data);
      setGaps(null);
    } catch (error) {
      fail(error, "요구사항과 테스트케이스를 연결하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  const inspectGaps = async () => {
    if (!projectId || !requirementIds.length) return;
    setPending(true);
    setProblem(null);
    try {
      const data = await api.post<TraceGapResult>(`/projects/${projectId}/trace-gaps`, {
        story_ids: [],
        requirement_ids: requirementIds,
        test_case_ids: testCase.trim() ? [testCase.trim()] : [],
      });
      setGaps(data);
      setSaved(null);
    } catch (error) {
      fail(error, "테스트 연결 누락을 확인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="traceability-manager" aria-labelledby="traceability-title">
      <header>
        <div>
          <span className="section-eyebrow">TRACEABILITY</span>
          <h3 id="traceability-title">요구사항 ↔ 테스트 연결</h3>
          <p>
            요구사항 ID와 테스트케이스 ID를 연결하고, 테스트가 연결되지 않은 요구사항을 점검합니다.
          </p>
        </div>
        <button
          className="secondary-button"
          data-testid="trace-gap-button"
          disabled={!projectId || !requirementIds.length || pending}
          onClick={() => void inspectGaps()}
        >
          연결 누락 점검
        </button>
      </header>

      <form
        className="trace-link-form"
        data-testid="trace-link-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label>
          <span>요구사항 ID</span>
          {requirementIds.length ? (
            <select
              value={selectedRequirement}
              onChange={(event) => setRequirement(event.target.value)}
            >
              {requirementIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              placeholder="REQ-001"
            />
          )}
        </label>
        <span className="trace-arrow" aria-hidden="true">
          ↔
        </span>
        <label>
          <span>테스트케이스 ID</span>
          <input
            value={testCase}
            onChange={(event) => setTestCase(event.target.value)}
            placeholder="TC-001"
          />
        </label>
        <label className="trace-story-field">
          <span>
            상위 사용자 스토리 ID <small>(선택)</small>
          </span>
          <input
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="US-001"
          />
        </label>
        <button
          className="primary-button"
          disabled={!projectId || !selectedRequirement.trim() || !testCase.trim() || pending}
        >
          {pending ? "처리 중…" : "연결 저장"}
        </button>
      </form>

      {saved ? (
        <p className="trace-success" role="status">
          <strong>{saved.requirement_id}</strong>와 <strong>{saved.test_case_id}</strong>가
          연결되었습니다.
        </p>
      ) : null}
      {gaps ? (
        <div
          className={`trace-gap-result ${gaps.requirement_ids.length ? "has-gaps" : "complete"}`}
          role="status"
        >
          <strong>
            {gaps.requirement_ids.length
              ? `${gaps.requirement_ids.length}개 요구사항의 테스트 연결이 없습니다.`
              : "모든 요구사항에 테스트가 연결되어 있습니다."}
          </strong>
          {gaps.requirement_ids.length ? <span>{gaps.requirement_ids.join(", ")}</span> : null}
        </div>
      ) : null}
      <SafeFeedback problem={problem} />
    </section>
  );
}
