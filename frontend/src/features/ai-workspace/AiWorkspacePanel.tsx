import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type AiWorkspaceState } from "../../shared/api/models";
import type { ActiveDocumentContext } from "./document-bridge";

const documentEditingPrompt = (
  document: ActiveDocumentContext,
  request: string,
): string => `현재 왼쪽 편집기의 문서를 아래 요청대로 수정하세요.
문서 제목: ${document.title}
문서 형식: ${document.artifactType}

<current_document>
${document.content}
</current_document>

<change_request>
${request}
</change_request>

현재 형식을 보존한 수정 후 전체 원문과 변경 요약을 응답 형식에 맞춰 반환하세요.`;

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
  onApplyDocumentChange: (content: string) => void;
}) {
  const [state, setState] = useState<AiWorkspaceState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [proposalVisible, setProposalVisible] = useState(true);
  const [appliedPreview, setAppliedPreview] = useState<string | null>(null);

  const fail = (error: unknown, code: string, message: string) =>
    setProblem(
      error instanceof ApiProblem ? error : new ApiProblem({ code, message, retryable: true }),
    );

  const start = async () => {
    if (!projectId) return;
    setPending(true);
    setProblem(null);
    try {
      setState(await api.post<AiWorkspaceState>(`/projects/${projectId}/ai-sessions`, {}));
      setProposalVisible(true);
      setAppliedPreview(null);
    } catch (error) {
      fail(error, "AI_SESSION_START_FAILED", "AI 대화를 시작하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  const send = async () => {
    if (!state || !activeDocument || !prompt.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      const next = await api.post<AiWorkspaceState>(
        `/projects/${projectId}/ai-sessions/${state.session_id}/messages`,
        { prompt: documentEditingPrompt(activeDocument, prompt.trim()) },
      );
      setState(next);
      setPrompt("");
      setProposalVisible(true);
      setAppliedPreview(null);
    } catch (error) {
      fail(error, "BEDROCK_INVOCATION_FAILED", "AI 응답 생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const applyProposal = () => {
    if (!state?.preview) return;
    onApplyDocumentChange(state.preview);
    setAppliedPreview(state.preview);
    setProposalVisible(false);
  };

  return (
    <aside className="ai-chat-panel" aria-label="AI 문서 도우미">
      <header className="ai-chat-header">
        <div>
          <span className="ai-status-dot" aria-hidden="true" />
          <div>
            <strong>AI 문서 도우미</strong>
            <span>{activeDocument?.title || "문서 선택 필요"}</span>
          </div>
        </div>
        <button
          className="ai-new-chat-button"
          data-testid="ai-new-session-button"
          disabled={!projectId || !activeDocument || pending}
          onClick={() => void start()}
          title="새 AI 대화"
        >
          + 새 대화
        </button>
      </header>

      <div className="ai-chat-history" aria-label="AI 대화 기록">
        {!state ? (
          <div className="ai-chat-welcome">
            <span aria-hidden="true">AI</span>
            <strong>왼쪽 문서를 함께 수정할게요.</strong>
            <p>문서를 선택한 뒤 추가·수정할 내용을 요청하면 전체 변경안을 먼저 보여드립니다.</p>
            <button
              disabled={!projectId || !activeDocument || pending}
              onClick={() => void start()}
            >
              대화 시작
            </button>
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

      {state?.preview && proposalVisible ? (
        <details className="ai-preview-card" open>
          <summary>왼쪽 문서 변경안</summary>
          <div className="ai-preview-content" data-testid="ai-preview-panel">
            {state.preview}
          </div>
          <div className="ai-proposal-actions">
            <button className="secondary" onClick={() => setProposalVisible(false)}>
              취소
            </button>
            <button
              data-testid="ai-apply-document-button"
              disabled={pending}
              onClick={applyProposal}
            >
              왼쪽 문서에 적용
            </button>
          </div>
        </details>
      ) : null}
      {appliedPreview ? (
        <p className="ai-apply-success" data-testid="ai-apply-success">
          변경안을 왼쪽 문서에 적용했습니다. 자동 저장됩니다.
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
          disabled={!state || !activeDocument || pending}
          placeholder={
            !activeDocument
              ? "왼쪽에서 문서를 선택하세요"
              : state
                ? "예: 아래쪽에 승인 절차 내용을 추가해줘"
                : "먼저 새 대화를 시작하세요"
          }
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
          disabled={!state || !activeDocument || !prompt.trim() || pending}
          aria-label="AI 요청 전송"
        >
          ↑
        </button>
        <small>Enter 전송 · Shift+Enter 줄바꿈</small>
      </form>

      {pending ? (
        <div className="ai-chat-processing" role="dialog" aria-modal="true" aria-label="AI 처리 중">
          <div>
            <span className="ai-processing-spinner" aria-hidden="true" />
            <strong>{state ? "문서 변경안을 만들고 있습니다" : "대화를 준비하고 있습니다"}</strong>
            <p>현재 문서를 분석하는 동안 잠시 기다려 주세요.</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
