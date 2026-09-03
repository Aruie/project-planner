import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("local automatic admin entry", () => {
  it("bypasses LoginScreen and loads the project sidebar only with the local Vite flag", async () => {
    const project = {
      project_id: "123e4567-e89b-12d3-a456-426614174000",
      name: "로컬 프로젝트",
      document_id_prefix: "LOCAL",
    };
    vi.doMock("./shared/api/runtime-config", async () => ({
      ...(await vi.importActual<typeof import("./shared/api/runtime-config")>(
        "./shared/api/runtime-config",
      )),
      localAutoLoginAccess: { username: "admin", password: "admin1234" },
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([project]))));

    const { default: App } = await import("./App");
    render(<App />);

    expect(screen.queryByTestId("login-submit-button")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /프로젝트 선택/ }));
    expect(
      await screen.findByTestId(`project-sidebar-item-${project.project_id}`),
    ).toBeInTheDocument();
  });
});
