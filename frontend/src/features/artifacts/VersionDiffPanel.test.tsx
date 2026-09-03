import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../shared/api/client";
import type { DiffResult, VersionResponse } from "../../shared/api/models";
import { VersionDiffPanel } from "./VersionDiffPanel";

const versions: VersionResponse[] = [
  {
    version_id: "v1-id",
    version_number: 1,
    source_draft_revision: 1,
    created_at: "2026-09-01T00:00:00Z",
    title: "문서",
    description: "",
    tags: [],
    change_summary: "최초 작성",
  },
  {
    version_id: "v2-id",
    version_number: 2,
    source_draft_revision: 2,
    created_at: "2026-09-02T00:00:00Z",
    title: "문서",
    description: "",
    tags: [],
    change_summary: "승인 절차 추가",
  },
];

const diff: DiffResult = {
  left: { kind: "version", version_id: "v2-id" },
  right: { kind: "draft" },
  metadata_changes: [],
  body_hunks: [
    { kind: "unchanged", before: ["# 문서"], after: ["# 문서"] },
    { kind: "added", before: [], after: ["## 승인 절차"] },
  ],
  summary: { added: 1, removed: 0, unchanged: 1 },
};

describe("VersionDiffPanel", () => {
  it("compares the latest previous version with current content using user-facing labels", async () => {
    const user = userEvent.setup();
    const get = vi.fn().mockResolvedValue(versions);
    const post = vi.fn().mockResolvedValue(diff);

    render(
      <VersionDiffPanel
        api={{ get, post } as unknown as ApiClient}
        projectId="project-1"
        artifactId="artifact-1"
      />,
    );

    const selector = await screen.findByLabelText("비교할 이전 버전");
    await waitFor(() => expect(selector).toHaveValue("v2-id"));
    expect(screen.queryByText("새로고침")).not.toBeInTheDocument();
    expect(screen.queryByText(/Draft/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "현재 내용과 비교" }));

    expect(post).toHaveBeenCalledWith("/projects/project-1/artifacts/artifact-1/diff", {
      left: { kind: "version", version_id: "v2-id" },
      right: { kind: "draft" },
    });
    expect(await screen.findAllByText("현재 편집 내용")).toHaveLength(2);
    expect(screen.getByLabelText("변경 요약")).toHaveTextContent("추가 1줄");
  });
});
