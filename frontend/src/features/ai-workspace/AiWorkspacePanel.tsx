import { useEffect, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type AiWorkspaceState } from "../../shared/api/models";
import type { ActiveDocumentContext } from "./document-bridge";

const visibleMessageContent = (role: string, content: string): string => {
  if (role !== "user") return content;
  return /<change_request>\s*([\s\S]*?)\s*<\/change_request>/.exec(content)?.[1] ?? content;
};

export function AiWorkspacePanel({
  api,
  projectId,
  activeDocument,
  onApplyDocumentChange,
}: {
  api: ApiClient;
  projectId: string;
  activeDocument: ActiveDocumentContext | null;
  onApplyDocumentChange: (targetArtifactId: string, content: string) => boolean;
}) {
  const [state, setState] = useState<AiWorkspaceState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(true);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [proposalVisible, setProposalVisible] = useState(true);
  const [appliedProposal, setAppliedProposal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return;
    void api
      .post<AiWorkspaceState>(`/projects/${projectId}/ai-sessions`, {})
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "AI_SESSION_START_FAILED",
                message: "AI 대화를 준비하지 못했습니다.",
                retryable: true,
              }),
        );
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, projectId]);

  const send = async () => {
    if (!state || !prompt.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      const activeArtifactId = activeDocument?.persisted
        ? activeDocument.documentKey
        : undefined;
      const next = await api.post<AiWorkspaceState>(
        `/projects/${projectId}/ai-sessions/${state.session_id}/messages`,
        {
          prompt: prompt.trim(),
          ...(activeArtifactId ? { active_artifact_id: activeArtifactId } : {}),
        },
      );
      setState(next);
      setPrompt("");
      setProposalVisible(true);
      setAppliedProposal(null);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "BEDROCK_INVOCATION_FAILED",
              message: "AI 응답 생성에 실패했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setPending(false);
    }
  };

  const applyProposal = () => {
    const targetArtifactId = state?.proposal_target_artifact_id;
    if (!state?.preview || !targetArtifactId) return;
    if (!onApplyDocumentChange(targetArtifactId, state.preview)) {
      setProblem(
        new ApiProblem({
          code: "AI_PROPOSAL_TARGET_NOT_FOUND",
          message: "변경 대상 문서를 프로젝트에서 찾지 못했습니다.",
          retryable: false,
        }),
      );
      return;
    }
    setAppliedProposal(`${targetArtifactId}:${state.preview}`);
    setProposalVisible(false);
  };

  const proposal =
    state?.response_type === "proposal" &&
    state.preview &&
    state.proposal_target_artifact_id
      ? state
      : null;

  return (
    <aside className="ai-chat-panel" aria-label="AI 프로젝트 도우미">
      <header className="ai-chat-header">
        <div>
          <span className="ai-status-dot" aria-hidden="true" />
          <div>
            <strong>AI 프로젝트 도우미</strong>
            <span>{activeDocument?.title || "프로젝트 전체 산출물"}</span>
          </div>
        </div>
      </header>

      <div className="ai-chat-history" aria-label="AI 대화 기록">
        {!state && pending ? (
          <div className="ai-chat-welcome">
            <span aria-hidden="true">AI</span>
            <strong>프로젝트 대화를 준비하고 있습니다.</strong>
            <p>프로젝트의 산출물과 최신 내용을 안전하게 불러오는 중입니다.</p>
          </div>
        ) : null}
        {state && state.messages.length === 0 ? (
          <div className="ai-chat-welcome">
            <span aria-hidden="true">AI</span>
            <strong>프로젝트에 관해 무엇이든 물어보세요.</strong>
            <p>산출물 요약·검색·비교를 요청하거나, 문서 변경이 필요할 때 명시해 주세요.</p>
          </div>
        ) : null}
        {state?.messages.map((message, index) => (
          <article
            className={`ai-message ${message.role === "user" ? "user" : "assistant"}`}
            key={`${message.created_at}-${index}`}
          >
            <span>{message.role === "user" ? "나" : "AI"}</span>
            <p>{visibleMessageContent(message.role, message.content)}</p>
          </article>
        ))}
      </div>

      {proposal && proposalVisible ? (
        <section className="ai-preview-card" data-testid="ai-proposal-card">
          <header>
            <strong>문서 변경안</strong>
            <span data-testid="ai-proposal-target">
              대상: {proposal.proposal_target_title || proposal.proposal_target_artifact_id}
            </span>
          </header>
          {proposal.proposal_changes ? (
            <pre className="ai-proposal-changes" data-testid="ai-proposal-changes">
              {proposal.proposal_changes}
            </pre>
          ) : (
            <p className="ai-proposal-no-diff">변경 부분 요약을 표시할 수 없습니다.</p>
          )}
          <details className="ai-full-proposal">
            <summary>전체 수정 문서 보기</summary>
            <pre className="ai-preview-content" data-testid="ai-preview-panel">
              {proposal.preview}
            </pre>
          </details>
          <div className="ai-proposal-actions">
            <button className="secondary" onClick={() => setProposalVisible(false)}>
              취소
            </button>
            <button
              data-testid="ai-apply-document-button"
              disabled={pending}
              onClick={applyProposal}
            >
              대상 문서에 적용
            </button>
          </div>
        </section>
      ) : null}
      {appliedProposal ? (
        <p className="ai-apply-success" data-testid="ai-apply-success">
          변경안을 대상 문서에 적용했습니다. 자동 저장됩니다.
        </p>
      ) : null}

      {problem ? (
        <p data-testid="ai-error-banner" className="ai-chat-error" role="alert">
          {problem.message}
        </p>
      ) : null}

      <form
        className="ai-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          data-testid="ai-prompt-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={!state || pending}
          placeholder="예: 프로젝트를 요약하거나 승인 절차가 있는지 찾아줘"
          rows={3}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          data-testid="ai-send-button"
          disabled={!state || !prompt.trim() || pending}
          aria-label="AI 요청 전송"
        >
          ↑
        </button>
        <small>Enter 전송 · Shift+Enter 줄바꿈</small>
      </form>

      {pending && state ? (
        <div className="ai-chat-processing" role="dialog" aria-modal="true" aria-label="AI 처리 중">
          <div>
            <span className="ai-processing-spinner" aria-hidden="true" />
            <strong>프로젝트 내용을 확인하고 있습니다</strong>
            <p>산출물을 분석하는 동안 잠시 기다려 주세요.</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
