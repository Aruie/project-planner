import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiWorkspacePanel } from "./AiWorkspacePanel";
import { ApiClient } from "../../shared/api/client";
import type { AiWorkspaceState } from "../../shared/api/models";

afterEach(cleanup);

const session: AiWorkspaceState = {
  session_id: "s",
  project_id: "p",
  messages: [],
  preview: null,
  response_type: null,
  expires_at: "2026-09-04T00:00:00Z",
};

const activeDocument = {
  documentKey: "artifact-1",
  title: "요구사항 정의서",
  artifactType: "MarkdownDocument" as const,
  content: "# 요구사항 정의서\n\n## 기존 내용\n원문입니다.",
  persisted: true,
};

describe("AiWorkspacePanel", () => {
  it("starts automatically and supports a normal project answer without an active document", async () => {
    const user = userEvent.setup();
    const answer: AiWorkspaceState = {
      ...session,
      response_type: "answer",
      messages: [
        { role: "user", content: "프로젝트를 요약해줘", created_at: "2026-09-03T00:00:00Z" },
        {
          role: "assistant",
          content: "요구사항 정의서와 테스트 문서가 있습니다.",
          created_at: "2026-09-03T00:00:01Z",
        },
      ],
    };
    const post = vi.fn().mockResolvedValueOnce(session).mockResolvedValueOnce(answer);
    const api = { post } as unknown as ApiClient;

    render(
      <AiWorkspacePanel
        api={api}
        projectId="p"
        activeDocument={null}
        onApplyDocumentChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(post).toHaveBeenCalledWith("/projects/p/ai-sessions", {}));
    expect(screen.queryByText("+ 새 대화")).not.toBeInTheDocument();
    expect(screen.queryByText("대화 시작")).not.toBeInTheDocument();
    await user.type(await screen.findByTestId("ai-prompt-input"), "프로젝트를 요약해줘");
    await user.click(screen.getByTestId("ai-send-button"));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1]).toEqual([
      "/projects/p/ai-sessions/s/messages",
      { prompt: "프로젝트를 요약해줘" },
    ]);
    expect(await screen.findByText("요구사항 정의서와 테스트 문서가 있습니다.")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-proposal-card")).not.toBeInTheDocument();
  });

  it("shows the target and changed lines, then applies the full proposal to that artifact", async () => {
    const user = userEvent.setup();
    let resolveProposal: ((value: AiWorkspaceState) => void) | undefined;
    const proposalPromise = new Promise<AiWorkspaceState>((resolve) => {
      resolveProposal = resolve;
    });
    const post = vi.fn().mockResolvedValueOnce(session).mockReturnValueOnce(proposalPromise);
    const onApplyDocumentChange = vi.fn().mockReturnValue(true);
    const api = { post } as unknown as ApiClient;

    render(
      <AiWorkspacePanel
        api={api}
        projectId="p"
        activeDocument={activeDocument}
        onApplyDocumentChange={onApplyDocumentChange}
      />,
    );

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await user.type(screen.getByTestId("ai-prompt-input"), "승인 절차를 추가해줘");
    await user.click(screen.getByTestId("ai-send-button"));

    expect(screen.getByRole("dialog", { name: "AI 처리 중" })).toBeInTheDocument();
    expect(post.mock.calls[1]).toEqual([
      "/projects/p/ai-sessions/s/messages",
      { prompt: "승인 절차를 추가해줘", active_artifact_id: "artifact-1" },
    ]);

    await act(async () => {
      resolveProposal?.({
        ...session,
        response_type: "proposal",
        preview: "# 수정본\n\n## 승인 절차\n승인자를 지정합니다.",
        proposal_target_artifact_id: "artifact-2",
        proposal_target_title: "설계서",
        proposal_changes: "+## 승인 절차\n+승인자를 지정합니다.",
        messages: [
          { role: "user", content: "승인 절차를 추가해줘", created_at: "2026-09-03T00:00:00Z" },
          { role: "assistant", content: "승인 절차를 추가했습니다.", created_at: "2026-09-03T00:00:01Z" },
        ],
      });
      await proposalPromise;
    });

    expect(await screen.findByTestId("ai-proposal-target")).toHaveTextContent("대상: 설계서");
    expect(screen.getByTestId("ai-proposal-changes")).toHaveTextContent("+## 승인 절차");
    await user.click(screen.getByTestId("ai-apply-document-button"));
    expect(onApplyDocumentChange).toHaveBeenCalledWith(
      "artifact-2",
      "# 수정본\n\n## 승인 절차\n승인자를 지정합니다.",
    );
    expect(screen.getByTestId("ai-apply-success")).toHaveTextContent("자동 저장됩니다");
  });
});
