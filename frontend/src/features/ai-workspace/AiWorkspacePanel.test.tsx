import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AiWorkspacePanel } from "./AiWorkspacePanel";
import { ApiClient } from "../../shared/api/client";

const state = {
  session_id: "s",
  project_id: "p",
  messages: [],
  preview: "# 임시",
  expires_at: "2026-09-04T00:00:00Z",
};

describe("AiWorkspacePanel", () => {
  it("keeps last successful preview on failed explicit send and enables reviewed save only for preview", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValueOnce(state).mockRejectedValueOnce(new Error("failed"));
    const api = { post } as unknown as ApiClient;
    render(<AiWorkspacePanel api={api} projectId="p" />);
    expect(screen.queryByTestId("ai-save-reviewed-button")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("ai-new-session-button"));
    expect(screen.getByTestId("ai-save-reviewed-button")).toBeEnabled();
    await user.type(screen.getByTestId("ai-prompt-input"), "수정");
    await user.click(screen.getByTestId("ai-send-button"));
    expect(screen.getByTestId("ai-preview-panel")).toHaveTextContent("# 임시");
    expect(screen.getByTestId("ai-error-banner")).toHaveTextContent("AI 응답 생성에 실패했습니다.");
    expect(screen.getByTestId("ai-save-reviewed-button")).toBeEnabled();
  });
});
