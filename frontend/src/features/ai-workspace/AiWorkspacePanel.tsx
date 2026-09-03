import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type AiWorkspaceState, type ArtifactResponse } from "../../shared/api/models";
import { Pending } from "../../shared/ui/SafeFeedback";

export function AiWorkspacePanel({ api, projectId }: { api: ApiClient; projectId: string }) {
  const [state, setState] = useState<AiWorkspaceState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("AI 요구사항정의서");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [saved, setSaved] = useState<ArtifactResponse | null>(null);

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
      setSaved(null);
    } catch (error) {
      fail(error, "AI_SESSION_START_FAILED", "AI 대화를 시작하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  const send = async () => {
    if (!state || !prompt.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      const next = await api.post<AiWorkspaceState>(
        `/projects/${projectId}/ai-sessions/${state.session_id}/messages`,
        { prompt: prompt.trim() },
      );
      setState(next);
      setPrompt("");
    } catch (error) {
      fail(error, "BEDROCK_INVOCATION_FAILED", "AI 응답 생성에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const save = async () => {
    if (!state?.preview || !title.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      setSaved(
        await api.post<ArtifactResponse>(
          `/projects/${projectId}/ai-sessions/${state.session_id}/reviewed-saves`,
          { title: title.trim(), tags: [] },
        ),
      );
    } catch (error) {
      fail(error, "AI_REVIEW_SAVE_FAILED", "검토한 AI 문서를 Draft로 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="ai-chat-panel" aria-label="AI 문서 도우미">
      <header className="ai-chat-header">
        <div>
          <span className="ai-status-dot" aria-hidden="true" />
          <div>
            <strong>AI 문서 도우미</strong>
            <span>{state ? "대화 중" : "준비됨"}</span>
          </div>
        </div>
        <button
          className="ai-new-chat-button"
          data-testid="ai-new-session-button"
          disabled={!projectId || pending}
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
            <strong>문서 작성을 함께 진행할게요.</strong>
            <p>새 대화를 시작한 후 요구사항 정리, 문장 개선, 누락 검토를 요청하세요.</p>
            <button disabled={!projectId || pending} onClick={() => void start()}>
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
            <p>{message.content}</p>
          </article>
        ))}
        {pending && state ? (
          <div className="ai-typing">
            <i />
            <i />
            <i />
            <span>응답을 준비하고 있습니다</span>
          </div>
        ) : null}
      </div>

      {state?.preview ? (
        <details className="ai-preview-card" open>
          <summary>생성된 문서 초안</summary>
          <div className="ai-preview-content" data-testid="ai-preview-panel">
            {state.preview}
          </div>
          <label>
            <span>저장 제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={pending}
            />
          </label>
          <button
            data-testid="ai-save-reviewed-button"
            disabled={!title.trim() || pending}
            onClick={() => void save()}
          >
            검토 완료 Draft 저장
          </button>
          {saved ? (
            <p className="ai-save-success">Draft 저장 완료 · {saved.public_document_id}</p>
          ) : null}
        </details>
      ) : null}

      {problem ? (
        <p data-testid="ai-error-banner" className="ai-chat-error" role="alert">
          {problem.message}
        </p>
      ) : null}
      <Pending active={pending && !state} />

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
          placeholder={state ? "문서에 대해 AI에게 요청하세요" : "먼저 새 대화를 시작하세요"}
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
    </aside>
  );
}
