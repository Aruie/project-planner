import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../shared/api/client";
import type { ProjectSummary } from "../../shared/api/models";
import { ProjectInformationModal } from "./ProjectInformationModal";

afterEach(cleanup);

const project: ProjectSummary = {
  project_id: "project-1",
  name: "프로젝트",
  document_id_prefix: "PRJ",
  task_name: "기존 과제",
  contractor_name: "기존 수탁기관",
  client_name: "기존 발주처",
  organization_name: "기존 회사",
};

describe("ProjectInformationModal", () => {
  it("updates project-owned cover information through the project API", async () => {
    const user = userEvent.setup();
    const updated = {
      ...project,
      task_name: "차세대 과제",
      contractor_name: "수탁기관 A",
      client_name: "발주처 B",
      organization_name: "회사 C",
    };
    const put = vi.fn().mockResolvedValue(updated);
    const onUpdated = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectInformationModal
        api={{ put } as unknown as ApiClient}
        project={project}
        onClose={onClose}
        onUpdated={onUpdated}
      />,
    );

    const taskName = screen.getByRole("textbox", { name: "과제명" });
    await user.clear(taskName);
    await user.type(taskName, "차세대 과제");
    const contractor = screen.getByRole("textbox", { name: "수탁기관" });
    await user.clear(contractor);
    await user.type(contractor, "수탁기관 A");
    const client = screen.getByRole("textbox", { name: "발주처" });
    await user.clear(client);
    await user.type(client, "발주처 B");
    const organization = screen.getByRole("textbox", { name: "회사·기관" });
    await user.clear(organization);
    await user.type(organization, "회사 C");
    await user.click(screen.getByRole("button", { name: "프로젝트 정보 저장" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/projects/project-1", {
        name: "프로젝트",
        task_name: "차세대 과제",
        contractor_name: "수탁기관 A",
        client_name: "발주처 B",
        organization_name: "회사 C",
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalled();
  });
});
