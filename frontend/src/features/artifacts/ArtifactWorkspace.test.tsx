import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArtifactWorkspace } from "./ArtifactWorkspace";
import { ApiClient } from "../../shared/api/client";
import type { ArtifactResponse, VersionResponse } from "../../shared/api/models";

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
  content: `# AIDLC 샘플 요구사항 정의서

## 목적
개발 산출물을 버전별로 관리하고 추적성을 확인한다.

## 요구사항
- REQ-001: 관리자는 산출물을 저장할 수 있다.`,
};

describe("ArtifactWorkspace", () => {
  it("disables creation without project context and creates only after explicit click", async () => {
    const user = userEvent.setup();
    const post = vi.fn().mockResolvedValue({ ...artifact, artifact_id: "a", project_id: "p" });
    const api = { get: vi.fn(), post } as unknown as ApiClient;
    const properties = {
      api,
      projectInformation: null,
      artifacts: [] as ArtifactResponse[],
      loadingArtifacts: false,
      listProblem: null,
      onArtifactsChange: vi.fn(),
      onArtifact: vi.fn(),
      onDeleted: vi.fn(),
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

  it("opens an existing document in preview and restores preview after tab changes", async () => {
    const user = userEvent.setup();
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
        projectInformation={null}
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("문서를 불러오는 중입니다");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    const previewButton = screen.getByRole("button", { name: "미리보기" });
    const historyButton = screen.getByRole("button", { name: "개정이력" });
    expect(previewButton).toHaveClass("active");
    expect(
      screen.getByText("개발 산출물을 버전별로 관리하고 추적성을 확인한다."),
    ).toBeInTheDocument();
    await user.click(historyButton);
    expect(historyButton).toHaveClass("active");
    expect(screen.getByText("아직 생성된 버전이 없습니다.")).toBeInTheDocument();
    await user.click(previewButton);
    expect(previewButton).toHaveClass("active");
    expect(
      screen.getByText("개발 산출물을 버전별로 관리하고 추적성을 확인한다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "원문편집" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "버전비교" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "파일 생성" })).toBeEnabled();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("renders immutable backend versions and their change summaries", async () => {
    const user = userEvent.setup();
    const version: VersionResponse = {
      version_id: "version-2",
      version_number: 2,
      source_draft_revision: 2,
      created_at: "2026-09-04T10:30:00+00:00",
      title: artifact.title,
      description: "sample",
      tags: ["sample"],
      change_summary: "승인 기준과 테스트 연결을 보완함",
    };
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(path.endsWith("/versions") ? [version] : detail),
      );

    render(
      <ArtifactWorkspace
        api={{ get } as unknown as ApiClient}
        projectId="sample-project"
        projectInformation={null}
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "개정이력" }));
    expect(screen.getAllByText("v2")).toHaveLength(2);
    expect(screen.getByText("승인 기준과 테스트 연결을 보완함")).toBeInTheDocument();
    expect(screen.getByText("Draft revision 2")).toBeInTheDocument();
  });

  it("requires the exact saved title before permanently deleting a document", async () => {
    const user = userEvent.setup();
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(path.endsWith("/versions") ? [] : detail),
      );
    const remove = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    render(
      <ArtifactWorkspace
        api={{ get, delete: remove } as unknown as ApiClient}
        projectId="sample-project"
        projectInformation={null}
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={onDeleted}
      />,
    );

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "문서 삭제" }));
    const deleteButton = screen.getByRole("button", { name: "영구 삭제" });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText("문서 제목 입력"), artifact.title);
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith("/projects/sample-project/artifacts/sample-artifact", {
        confirmation_title: artifact.title,
      }),
    );
    expect(onDeleted).toHaveBeenCalledWith("sample-artifact");
  });
});
