import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.unstubAllGlobals());

describe("login and project sidebar", () => {
  it("hides workspace until login, loads sidebar, selects explicitly, and logs out", async () => {
    const user = userEvent.setup();
    const project = {
      project_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "프로젝트 A",
      document_id_prefix: "PROJ",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ username: "admin" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([project]), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })),
    );
    render(<App />);
    expect(screen.queryByTestId("project-sidebar")).not.toBeInTheDocument();
    await user.type(screen.getByTestId("login-username-input"), "admin");
    await user.type(screen.getByTestId("login-password-input"), "local-dev-password");
    await user.click(screen.getByTestId("login-submit-button"));
    expect(screen.getByTestId("project-sidebar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /프로젝트 선택/ }));
    const item = await screen.findByTestId(`project-sidebar-item-${project.project_id}`);
    await user.click(item);
    await waitFor(() => expect(screen.getByText("등록된 산출물이 없습니다.")).toBeInTheDocument());
    await user.click(screen.getByTestId("logout-button"));
    await waitFor(() => expect(screen.getByTestId("login-submit-button")).toBeInTheDocument());
    expect(screen.queryByTestId("project-sidebar")).not.toBeInTheDocument();
  });
});
