import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./shared/api/runtime-config", async () => {
  const actual = await vi.importActual<typeof import("./shared/api/runtime-config")>(
    "./shared/api/runtime-config",
  );
  return {
    ...actual,
    apiBaseUrl: "",
    localAutoLoginAccess: { username: "admin", password: "password" },
  };
});

vi.mock("./features/projects/ProjectSidebar", () => ({
  ProjectSidebar: (props: {
    artifacts: Array<{ artifact_id: string; title: string }>;
    onSelectProject: (project: {
      project_id: string;
      name: string;
      document_id_prefix: string;
      task_name: string;
      contractor_name: string;
      client_name: string;
      organization_name: string;
    }) => void;
    onSelectArtifact: (artifact: unknown) => void;
  }) => (
    <nav>
      <button
        data-testid="select-project"
        onClick={() =>
          void props.onSelectProject({
            project_id: "123e4567-e89b-12d3-a456-426614174000",
            name: "프로젝트",
            document_id_prefix: "PRJ",
            task_name: "",
            contractor_name: "",
            client_name: "",
            organization_name: "",
          })
        }
      >
        프로젝트 선택
      </button>
      {props.artifacts.map((artifact) => (
        <button
          data-testid={`select-${artifact.artifact_id}`}
          key={artifact.artifact_id}
          onClick={() => props.onSelectArtifact(artifact)}
        >
          {artifact.title}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock("./features/artifacts/ArtifactWorkspace", async () => {
  const React = await import("react");
  return {
    ArtifactWorkspace: (props: {
      initialArtifact: { artifact_id: string; title: string; artifact_type: "MarkdownDocument" };
      onDocumentContextChange: (document: {
        documentKey: string;
        title: string;
        artifactType: "MarkdownDocument";
        content: string;
        persisted: boolean;
      }) => void;
      aiDocumentUpdate: { documentKey: string; content: string } | null;
    }) => {
      const { initialArtifact, onDocumentContextChange } = props;
      React.useEffect(() => {
        onDocumentContextChange({
          documentKey: initialArtifact.artifact_id,
          title: initialArtifact.title,
          artifactType: "MarkdownDocument",
          content: `# ${initialArtifact.title}`,
          persisted: true,
        });
      }, [initialArtifact, onDocumentContextChange]);
      const applied =
        props.aiDocumentUpdate?.documentKey === initialArtifact.artifact_id
          ? props.aiDocumentUpdate.content
          : "";
      return (
        <section data-testid="mock-artifact-workspace">
          <span data-testid="open-artifact">{initialArtifact.artifact_id}</span>
          <pre data-testid="applied-content">{applied}</pre>
        </section>
      );
    },
  };
});

import App from "./App";

const artifacts = [
  {
    artifact_id: "artifact-1",
    project_id: "123e4567-e89b-12d3-a456-426614174000",
    public_document_id: "PRJ-001",
    artifact_type: "MarkdownDocument",
    draft_id: "draft-1",
    revision: 1,
    title: "요구사항",
    description: "",
    tags: [],
  },
  {
    artifact_id: "artifact-2",
    project_id: "123e4567-e89b-12d3-a456-426614174000",
    public_document_id: "PRJ-002",
    artifact_type: "MarkdownDocument",
    draft_id: "draft-2",
    revision: 1,
    title: "설계서",
    description: "",
    tags: [],
  },
];

const session = {
  session_id: "session-1",
  project_id: "123e4567-e89b-12d3-a456-426614174000",
  messages: [],
  preview: null,
  response_type: null,
  expires_at: "2026-09-04T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("project AI proposal application", () => {
  it("loads and updates the proposal target without restarting chat", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "GET" && url.endsWith("/projects/123e4567-e89b-12d3-a456-426614174000/artifacts")) {
        return new Response(JSON.stringify(artifacts), { status: 200 });
      }
      if (init?.method === "POST" && url.endsWith("/projects/123e4567-e89b-12d3-a456-426614174000/ai-sessions")) {
        return new Response(JSON.stringify(session), { status: 200 });
      }
      if (init?.method === "POST" && url.endsWith("/messages")) {
        return new Response(
          JSON.stringify({
            ...session,
            response_type: "proposal",
            preview: "# 수정된 설계서\n\n승인 절차",
            proposal_target_artifact_id: "artifact-2",
            proposal_target_title: "설계서",
            proposal_changes: "+승인 절차",
            messages: [
              { role: "user", content: "설계서 수정", created_at: "2026-09-03T00:00:00Z" },
              { role: "assistant", content: "수정했습니다.", created_at: "2026-09-03T00:00:01Z" },
            ],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId("select-project"));
    await user.click(await screen.findByTestId("select-artifact-1"));
    await waitFor(() => expect(screen.getByTestId("open-artifact")).toHaveTextContent("artifact-1"));
    await user.type(await screen.findByTestId("ai-prompt-input"), "설계서 수정");
    await user.click(screen.getByTestId("ai-send-button"));
    await user.click(await screen.findByTestId("ai-apply-document-button"));

    await waitFor(() => expect(screen.getByTestId("open-artifact")).toHaveTextContent("artifact-2"));
    await waitFor(() =>
      expect(screen.getByTestId("applied-content")).toHaveTextContent("# 수정된 설계서"),
    );
    const sessionStarts = fetchMock.mock.calls.filter(
      ([input, init]) =>
        init?.method === "POST" && String(input).endsWith("/projects/123e4567-e89b-12d3-a456-426614174000/ai-sessions"),
    );
    expect(sessionStarts).toHaveLength(1);
  });
});
