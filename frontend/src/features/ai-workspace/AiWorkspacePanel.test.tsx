import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AiWorkspacePanel } from "./AiWorkspacePanel";
import { ApiClient } from "../../shared/api/client";

const session = {
  session_id: "s",
  project_id: "p",
  messages: [],
  preview: null,
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
  it("sends the current document and applies the approved proposal to the left editor", async () => {
    const user = userEvent.setup();
    type ProposalState = Omit<typeof session, "preview"> & { preview: string };
    let resolveProposal: ((value: ProposalState) => void) | undefined;
    const proposal = new Promise<ProposalState>((resolve) => {
      resolveProposal = resolve;
    });
    const post = vi.fn().mockResolvedValueOnce(session).mockReturnValueOnce(proposal);
    const onApplyDocumentChange = vi.fn();
    const api = { post } as unknown as ApiClient;

    render(
      <AiWorkspacePanel
        api={api}
        projectId="p"
        activeDocument={activeDocument}
        onApplyDocumentChange={onApplyDocumentChange}
      />,
    );

    await user.click(screen.getByTestId("ai-new-session-button"));
    await user.type(screen.getByTestId("ai-prompt-input"), "승인 절차를 추가해줘");
    await user.click(screen.getByTestId("ai-send-button"));

    expect(screen.getByRole("dialog", { name: "AI 처리 중" })).toBeInTheDocument();
    const calls = post.mock.calls as unknown as Array<[string, { prompt: string }]>;
    const prompt = calls[1]?.[1].prompt;
    expect(prompt).toContain("<current_document>");
    expect(prompt).toContain(activeDocument.content);
    expect(prompt).toContain("<change_request>\n승인 절차를 추가해줘\n</change_request>");

    await act(async () => {
      resolveProposal?.({ ...session, preview: "# 수정본\n\n승인 절차" });
      await proposal;
    });

    expect(await screen.findByTestId("ai-preview-panel")).toHaveTextContent("승인 절차");
    await user.click(screen.getByTestId("ai-apply-document-button"));
    expect(onApplyDocumentChange).toHaveBeenCalledWith("# 수정본\n\n승인 절차");
    await waitFor(() => {
      expect(screen.getByTestId("ai-apply-success")).toHaveTextContent("자동 저장됩니다");
    });
    expect(screen.queryByTestId("ai-save-reviewed-button")).not.toBeInTheDocument();
  });
});
