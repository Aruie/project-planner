import { useCallback, useEffect, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type ArtifactResponse, type ProjectSummary } from "../../shared/api/models";
import { ProjectInformationModal } from "./ProjectInformationModal";

export function ProjectSidebar({
  api,
  activeProjectId,
  activeProjectName,
  artifacts,
  loadingArtifacts,
  artifactProblem,
  activeArtifactId,
  onSelectProject,
  onProjectUpdated,
  onSelectArtifact,
  onNewArtifact,
  onLogout,
}: {
  api: ApiClient;
  activeProjectId: string;
  activeProjectName: string;
  artifacts: ArtifactResponse[];
  loadingArtifacts: boolean;
  artifactProblem: ApiProblem | null;
  activeArtifactId: string;
  onSelectProject: (project: ProjectSummary) => void;
  onProjectUpdated: (project: ProjectSummary) => void;
  onSelectArtifact: (artifact: ArtifactResponse) => void;
  onNewArtifact: () => void;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [informationModalOpen, setInformationModalOpen] = useState(false);
  const activeProject = projects.find((project) => project.project_id === activeProjectId);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      setProjects(await api.get<ProjectSummary[]>("/projects"));
    } catch (reason) {
      setError(
        reason instanceof ApiProblem ? reason.message : "프로젝트 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoadingProjects(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    void api
      .get<ProjectSummary[]>("/projects", controller.signal)
      .then((items) => setProjects(items))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(
          reason instanceof ApiProblem ? reason.message : "프로젝트 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingProjects(false);
      });
    return () => controller.abort();
  }, [api]);

  const chooseProject = (project: ProjectSummary) => {
    onSelectProject(project);
    setModalOpen(false);
  };

  const applyProjectUpdate = (project: ProjectSummary) => {
    setProjects((items) =>
      items.map((item) => (item.project_id === project.project_id ? project : item)),
    );
    onProjectUpdated(project);
  };

  return (
    <>
      <aside className="project-sidebar" data-testid="project-sidebar">
        <div className="product-brand">
          <div className="product-logo" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <strong>산출물 관리</strong>
            <small>프로그램</small>
          </div>
        </div>

        <div className="sidebar-section-title">PROJECT</div>
        <button className="project-switcher" onClick={() => setModalOpen(true)}>
          <span className="project-switcher-icon">
            {activeProjectName ? activeProjectName.trim().slice(0, 1).toUpperCase() : "+"}
          </span>
          <span className="project-switcher-copy">
            <small>{activeProjectId ? "현재 프로젝트" : "프로젝트 선택"}</small>
            <strong>{activeProjectName || "작업할 프로젝트를 선택하세요"}</strong>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        {activeProject ? (
          <button
            className="project-information-button"
            onClick={() => setInformationModalOpen(true)}
          >
            <span>프로젝트 정보</span>
            <small>{activeProject.task_name || "과제명과 기관 정보를 입력하세요"}</small>
          </button>
        ) : null}

        <div className="sidebar-artifact-heading">
          <div>
            <span>산출물</span>
            {activeProjectId ? <em>{artifacts.length}</em> : null}
          </div>
          <button disabled={!activeProjectId} onClick={onNewArtifact} aria-label="새 산출물 작성">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {!activeProjectId ? (
          <div className="sidebar-artifact-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5.5h6l2 2h8v11H4z" />
            </svg>
            <span>프로젝트를 먼저 선택하세요.</span>
          </div>
        ) : null}
        {activeProjectId && loadingArtifacts ? (
          <div className="artifact-nav-skeleton">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {activeProjectId && artifactProblem ? (
          <div className="sidebar-artifact-error" role="alert">
            {artifactProblem.message}
          </div>
        ) : null}
        {activeProjectId && !loadingArtifacts && !artifactProblem && artifacts.length === 0 ? (
          <div className="sidebar-artifact-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 3h10l4 4v14H5zM14 3v5h5" />
            </svg>
            <span>등록된 산출물이 없습니다.</span>
            <button onClick={onNewArtifact}>첫 산출물 작성</button>
          </div>
        ) : null}

        <nav className="sidebar-artifact-list" aria-label="산출물 목록" data-testid="artifact-list">
          {artifacts.map((artifact) => (
            <button
              key={artifact.artifact_id}
              className={activeArtifactId === artifact.artifact_id ? "active" : ""}
              data-testid={`artifact-list-item-${artifact.artifact_id}`}
              onClick={() => onSelectArtifact(artifact)}
            >
              <span
                className={`sidebar-document-icon ${artifact.artifact_type === "ExcelDocument" ? "xlsx" : "docx"}`}
              >
                {artifact.artifact_type === "ExcelDocument" ? "X" : "W"}
              </span>
              <span>
                <strong>{artifact.title}</strong>
                <small>
                  {artifact.public_document_id} · r{artifact.revision}
                </small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <span className="account-avatar">A</span>
          <span>
            <strong>Administrator</strong>
            <small>Local workspace</small>
          </span>
          <button data-testid="logout-button" onClick={onLogout} aria-label="로그아웃">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3M14 4h6v16h-6" />
            </svg>
          </button>
        </div>
      </aside>

      {modalOpen ? (
        <div
          className="project-modal-backdrop"
          role="presentation"
          onMouseDown={() => setModalOpen(false)}
        >
          <section
            className="project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>WORKSPACE</p>
                <h2 id="project-modal-title">프로젝트 선택</h2>
                <span>산출물을 관리할 프로젝트를 선택하세요.</span>
              </div>
              <button onClick={() => setModalOpen(false)} aria-label="닫기">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            {loadingProjects ? (
              <div className="project-modal-loading">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {error ? (
              <div className="project-modal-error" role="alert">
                <span>{error}</span>
                <button data-testid="projects-retry-button" onClick={() => void loadProjects()}>
                  다시 시도
                </button>
              </div>
            ) : null}
            <div className="project-modal-list">
              {projects.map((project) => (
                <button
                  key={project.project_id}
                  className={activeProjectId === project.project_id ? "active" : ""}
                  data-testid={`project-sidebar-item-${project.project_id}`}
                  onClick={() => chooseProject(project)}
                >
                  <span className="modal-project-monogram">
                    {project.name.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{project.name}</strong>
                    <small>
                      {project.document_id_prefix} · {project.project_id}
                    </small>
                  </span>
                  {activeProjectId === project.project_id ? (
                    <em>선택됨</em>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {informationModalOpen && activeProject ? (
        <ProjectInformationModal
          api={api}
          project={activeProject}
          onClose={() => setInformationModalOpen(false)}
          onUpdated={applyProjectUpdate}
        />
      ) : null}
    </>
  );
}
