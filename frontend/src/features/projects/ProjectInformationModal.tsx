import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type ProjectSummary } from "../../shared/api/models";
import { BlockingProgress, SafeFeedback } from "../../shared/ui/SafeFeedback";

export function ProjectInformationModal({
  api,
  project,
  onClose,
  onUpdated,
}: {
  api: ApiClient;
  project: ProjectSummary;
  onClose: () => void;
  onUpdated: (project: ProjectSummary) => void;
}) {
  const [values, setValues] = useState({
    name: project.name,
    task_name: project.task_name,
    contractor_name: project.contractor_name,
    client_name: project.client_name,
    organization_name: project.organization_name,
  });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);

  const update = (field: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!values.name.trim() || saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const updated = await api.put<ProjectSummary>(`/projects/${project.project_id}`, {
        name: values.name.trim(),
        task_name: values.task_name.trim(),
        contractor_name: values.contractor_name.trim(),
        client_name: values.client_name.trim(),
        organization_name: values.organization_name.trim(),
      });
      onUpdated(updated);
      onClose();
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "PROJECT_UPDATE_FAILED",
              message: "프로젝트 정보를 저장하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="project-modal-backdrop" onMouseDown={() => !saving && onClose()}>
      <section
        className="project-modal project-information-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-information-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>PROJECT INFORMATION</p>
            <h2 id="project-information-title">프로젝트 정보</h2>
            <span>모든 산출물의 표지에서 공통으로 사용하는 정보입니다.</span>
          </div>
          <button onClick={onClose} aria-label="닫기" disabled={saving}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="project-information-form">
          <label>
            <span>프로젝트명</span>
            <input
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            <span>과제명</span>
            <input
              value={values.task_name}
              onChange={(event) => update("task_name", event.target.value)}
              maxLength={500}
              placeholder="예: 차세대 업무시스템 구축"
            />
          </label>
          <label>
            <span>수탁기관</span>
            <input
              value={values.contractor_name}
              onChange={(event) => update("contractor_name", event.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            <span>발주처</span>
            <input
              value={values.client_name}
              onChange={(event) => update("client_name", event.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            <span>회사·기관</span>
            <input
              value={values.organization_name}
              onChange={(event) => update("organization_name", event.target.value)}
              maxLength={500}
            />
          </label>
          <p>문서별 front matter가 아니라 프로젝트 정보가 표지의 기준값으로 사용됩니다.</p>
          <SafeFeedback problem={problem} />
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button
            className="primary-button"
            onClick={() => void save()}
            disabled={!values.name.trim() || saving}
          >
            {saving ? "저장 중…" : "프로젝트 정보 저장"}
          </button>
        </footer>
      </section>
      <BlockingProgress
        active={saving}
        title="프로젝트 정보를 저장하고 있습니다"
        description="모든 산출물에 적용할 표지 기준정보를 갱신하는 중입니다."
      />
    </div>
  );
}
