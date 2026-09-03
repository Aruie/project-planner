import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactWorkspace } from "./ArtifactWorkspace";
import { ApiClient } from "../../shared/api/client";
import type { ArtifactResponse } from "../../shared/api/models";

afterEach(cleanup);

const artifact: ArtifactResponse = {
  artifact_id: "sample-artifact",
  project_id: "sample-project",
  public_document_id: "AIDLC-002",
  artifact_type: "MarkdownDocument",
  draft_id: "draft",
  revision: 2,
  title: "AIDLC 샘플 요구사항 정의서",
  description: "sample",
  tags: ["sample"],
};

const detail = {
  ...artifact,
  content: `---\ntitle: AIDLC 샘플 요구사항 정의서\ndocument_id: AIDLC-002\n---\n# 요구사항 정의서\n\n본문`,
};

describe("ArtifactWorkspace", () => {
  it("disables creation without project context and creates only after explicit click", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValue({ ...artifact, artifact_id: "a", project_id: "p" });
    const api = { get: vi.fn(), post } as unknown as ApiClient;
    const properties = {
      api,
      artifacts: [] as ArtifactResponse[],
      loadingArtifacts: false,
      listProblem: null,
      onArtifactsChange: vi.fn(),
      onArtifact: vi.fn(),
    };
    const view = render(<ArtifactWorkspace {...properties} projectId="" />);

    expect(screen.getByTestId("artifact-create-button")).toBeDisabled();
    view.rerender(<ArtifactWorkspace {...properties} projectId="p" />);
    await user.type(screen.getByTestId("artifact-title-input"), "문서");
    await user.click(screen.getByTestId("artifact-create-button"));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/projects/p/artifacts", {
      metadata: { title: "문서", artifact_type: "MarkdownDocument" },
      content: "",
    });
  });

  it("shows initial loading and opens an existing document on the information-first unified tabs", async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(path.endsWith("/versions") ? [] : detail),
      );
    const api = { get } as unknown as ApiClient;

    render(
      <ArtifactWorkspace
        api={api}
        projectId="sample-project"
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("문서를 불러오는 중입니다");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "문서정보" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "미리보기" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "원문편집" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "버전정보" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "파일 생성" })).toBeEnabled();
    expect(screen.getByText("개정 이력 없음")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
