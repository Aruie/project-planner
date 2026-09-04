import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
      onDocumentContextChange: vi.fn(),
      aiDocumentUpdate: null,
    };
    const view = render(<ArtifactWorkspace {...properties} projectId="" />);

    expect(screen.getByTestId("artifact-create-button")).toBeDisabled();
    view.rerender(<ArtifactWorkspace {...properties} projectId="p" />);
    await user.click(screen.getByTestId("artifact-title-edit-button"));
    await user.type(screen.getByTestId("artifact-title-input"), "문서");
    await user.click(screen.getByRole("button", { name: "제목 저장" }));
    await user.click(screen.getByTestId("artifact-create-button"));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/projects/p/artifacts", {
      metadata: { title: "문서", artifact_type: "MarkdownDocument" },
      content: "",
    });
  });

  it("previews a new Word document with a database title and heading-derived TOC", () => {
    const template = {
      templateId: "generic-word",
      title: "새 Word 문서",
      description: "일반 문서",
      artifactType: "MarkdownDocument" as const,
      content: "## 문서 개요\n\n문서 내용을 작성하세요.",
    };

    render(
      <ArtifactWorkspace
        api={{} as ApiClient}
        projectId="sample-project"
        projectInformation={null}
        initialTemplate={template}
        artifacts={[]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={vi.fn()}
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "새 Word 문서" })).toBeInTheDocument();
    expect(screen.getAllByText("문서 개요")).toHaveLength(2);
    expect(screen.queryByText("본문")).not.toBeInTheDocument();
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
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    expect(screen.getByText("문서를 불러오는 중입니다")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("문서를 불러오는 중입니다")).not.toBeInTheDocument(),
    );
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
    expect(screen.getByRole("button", { name: "PDF 생성" })).toBeEnabled();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("inserts a selected image thumbnail at the current Markdown cursor", async () => {
    const user = userEvent.setup();
    const image = {
      attachment_id: "image-1",
      media_type: "image/png",
      filename: "20_기술검증서_img_109.png",
      markdown_path: "assets/20_기술검증서_img_109.png",
      thumbnail_base64: "dGh1bWI=",
      content_base64: null,
    };
    const get = vi.fn().mockImplementation((path: string) => {
      if (path.endsWith("/versions")) return Promise.resolve([]);
      if (path.endsWith("/attachments/image-1")) {
        return Promise.resolve({ ...image, content_base64: "b3JpZ2luYWw=" });
      }
      if (path.endsWith("/attachments")) return Promise.resolve([image]);
      return Promise.resolve(detail);
    });
    const put = vi.fn().mockResolvedValue({ ...artifact, revision: 3 });

    render(
      <ArtifactWorkspace
        api={{ get, put } as unknown as ApiClient}
        projectId="sample-project"
        projectInformation={null}
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={vi.fn()}
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("문서를 불러오는 중입니다")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "원문편집" }));
    const editor = (await screen.findByTestId("artifact-content-input")) as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(0, 0);
    await user.type(
      screen.getByPlaceholderText("예: 미들웨어 테스트 결과"),
      "미들웨어 테스트 결과",
    );
    await user.click(
      await screen.findByTitle("20_기술검증서_img_109.png을 현재 커서 위치에 삽입"),
    );

    expect(editor.value).toMatch(
      /^!\[미들웨어 테스트 결과\]\(assets\/20_기술검증서_img_109\.png\)/,
    );

    await user.click(screen.getByRole("button", { name: "미리보기" }));
    const previewImage = await screen.findByRole("img", { name: "미들웨어 테스트 결과" });
    await waitFor(() => expect(previewImage).toHaveAttribute("src", "data:image/png;base64,b3JpZ2luYWw="));
  });

  it("opens a filename modal and requests a named PDF export", async () => {
    const user = userEvent.setup();
    const version: VersionResponse = {
      version_id: "version-3",
      version_number: 3,
      source_draft_revision: 3,
      created_at: "2026-09-03T10:30:00+00:00",
      title: artifact.title,
      description: "sample",
      tags: ["sample"],
      change_summary: "최종 검토",
    };
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(path.endsWith("/versions") ? [version] : detail),
      );
    const download = vi.fn().mockReturnValue(new Promise(() => undefined));

    render(
      <ArtifactWorkspace
        api={{ get, download } as unknown as ApiClient}
        projectId="sample-project"
        projectInformation={null}
        initialArtifact={artifact}
        artifacts={[artifact]}
        loadingArtifacts={false}
        listProblem={null}
        onArtifactsChange={vi.fn()}
        onArtifact={vi.fn()}
        onDeleted={vi.fn()}
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("문서를 불러오는 중입니다")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("artifact-title-input")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "PDF 생성" }));

    const dialog = screen.getByRole("dialog", { name: "파일 이름을 확인하세요" });
    const filename = within(dialog).getByTestId("pdf-filename-input");
    expect(filename).toHaveValue("AIDLC_샘플_요구사항_정의서_v3");
    expect(within(dialog).getByText(".pdf")).toBeInTheDocument();

    await user.clear(filename);
    await user.type(filename, "최종 보고서.pdf");
    expect(filename).toHaveValue("최종 보고서");
    await user.click(within(dialog).getByRole("button", { name: "PDF 생성" }));

    await waitFor(() =>
      expect(download).toHaveBeenCalledWith(
        "/projects/sample-project/artifacts/sample-artifact/exports/pdf",
        expect.objectContaining({
          markdown: detail.content,
          filename: "최종 보고서.pdf",
          model: expect.objectContaining({
            cover: expect.objectContaining({ title: artifact.title }),
          }),
        }),
      ),
    );
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
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("문서를 불러오는 중입니다")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "개정이력" }));
    expect(screen.getAllByText("v2")).toHaveLength(2);
    expect(screen.getByText("승인 기준과 테스트 연결을 보완함")).toBeInTheDocument();
    expect(screen.getByText("저장 기준 2차 수정본")).toBeInTheDocument();
  });

  it("publishes the active document, applies an AI update, and autosaves it", async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(path.endsWith("/versions") ? [] : detail),
      );
    const put = vi.fn().mockResolvedValue({ ...artifact, revision: 3 });
    const onDocumentContextChange = vi.fn();
    const commonProperties = {
      api: { get, put } as unknown as ApiClient,
      projectId: "sample-project",
      projectInformation: null,
      initialArtifact: artifact,
      artifacts: [artifact],
      loadingArtifacts: false,
      listProblem: null,
      onArtifactsChange: vi.fn(),
      onArtifact: vi.fn(),
      onDeleted: vi.fn(),
      onDocumentContextChange,
    };

    const view = render(<ArtifactWorkspace {...commonProperties} aiDocumentUpdate={null} />);

    await waitFor(() =>
      expect(onDocumentContextChange).toHaveBeenCalledWith(
        expect.objectContaining({
          documentKey: artifact.artifact_id,
          title: artifact.title,
          content: detail.content,
          persisted: true,
        }),
      ),
    );

    view.rerender(
      <ArtifactWorkspace
        {...commonProperties}
        aiDocumentUpdate={{
          documentKey: artifact.artifact_id,
          content: "# AI 수정본\n\n## 승인 절차\n승인자를 지정한다.",
          requestId: 1,
        }}
      />,
    );

    expect(await screen.findByText("승인자를 지정한다.")).toBeInTheDocument();
    expect(screen.queryByTestId("artifact-save-button")).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(put).toHaveBeenCalledWith(
          "/projects/sample-project/artifacts/sample-artifact/draft",
          expect.objectContaining({
            expected_revision: 2,
            title: artifact.title,
            content: expect.stringContaining("승인자를 지정한다."),
          }),
        ),
      { timeout: 2500 },
    );
    expect(await screen.findByText("자동 저장됨")).toBeInTheDocument();
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
        onDocumentContextChange={vi.fn()}
        aiDocumentUpdate={null}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText("문서를 불러오는 중입니다")).not.toBeInTheDocument(),
    );
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
