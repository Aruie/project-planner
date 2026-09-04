import { useEffect, useMemo, useState } from "react";
import { LoginScreen } from "./features/auth/LoginScreen";
import { ProjectSidebar } from "./features/projects/ProjectSidebar";
import { ArtifactWorkspace } from "./features/artifacts/ArtifactWorkspace";
import { TemplateSelectionModal } from "./features/artifacts/TemplateSelectionModal";
import { type TemplateDraft } from "./features/artifacts/document-templates";
import { AiWorkspacePanel } from "./features/ai-workspace/AiWorkspacePanel";
import type {
  ActiveDocumentContext,
  AiDocumentUpdate,
} from "./features/ai-workspace/document-bridge";
import { ApiClient } from "./shared/api/client";
import { ApiProblem, type ArtifactResponse, type ProjectSummary } from "./shared/api/models";
import { apiBaseUrl, localAutoLoginAccess, type RuntimeAccess } from "./shared/api/runtime-config";
import { ProjectProvider, useProject } from "./shared/project/ProjectContext";

type PendingAiProposal = {
  targetArtifactId: string;
  content: string;
};

function Workspace({ access, onLogout }: { access: RuntimeAccess; onLogout: () => void }) {
  const { projectId, setProjectId } = useProject();
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [artifactId, setArtifactId] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactResponse | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const [draftTemplate, setDraftTemplate] = useState<TemplateDraft | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactResponse[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactListProblem, setArtifactListProblem] = useState<ApiProblem | null>(null);
  const [activeDocument, setActiveDocument] = useState<ActiveDocumentContext | null>(null);
  const [aiDocumentUpdate, setAiDocumentUpdate] = useState<AiDocumentUpdate | null>(null);
  const [pendingAiProposal, setPendingAiProposal] = useState<PendingAiProposal | null>(null);
  const api = useMemo(() => new ApiClient(apiBaseUrl, () => access), [access]);

  useEffect(() => {
    if (!pendingAiProposal || activeDocument?.documentKey !== pendingAiProposal.targetArtifactId) {
      return;
    }
    const dispatch = window.setTimeout(() => {
      setAiDocumentUpdate((current) => ({
        documentKey: pendingAiProposal.targetArtifactId,
        content: pendingAiProposal.content,
        requestId: (current?.requestId ?? 0) + 1,
      }));
      setPendingAiProposal(null);
    }, 0);
    return () => window.clearTimeout(dispatch);
  }, [activeDocument, pendingAiProposal]);

  const selectProject = async (project: ProjectSummary) => {
    if (!setProjectId(project.project_id)) return;
    setSelectedProject(project);
    setActiveDocument(null);
    setAiDocumentUpdate(null);
    setPendingAiProposal(null);
    setArtifactId("");
    setSelectedArtifact(null);
    setDraftTemplate(null);
    setEditorSession((value) => value + 1);
    setArtifacts([]);
    setArtifactListProblem(null);
    setLoadingArtifacts(true);
    try {
      setArtifacts(await api.get<ArtifactResponse[]>(`/projects/${project.project_id}/artifacts`));
    } catch (error) {
      setArtifactListProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "NETWORK_ERROR",
              message: "산출물 목록을 불러오지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setLoadingArtifacts(false);
    }
  };

  const selectArtifact = (artifact: ArtifactResponse) => {
    setActiveDocument(null);
    setAiDocumentUpdate(null);
    setPendingAiProposal(null);
    setDraftTemplate(null);
    setSelectedArtifact(artifact);
    setArtifactId(artifact.artifact_id);
  };

  const startNewArtifact = () => {
    setTemplateModalOpen(true);
  };

  const selectTemplate = (template: TemplateDraft) => {
    setActiveDocument(null);
    setAiDocumentUpdate(null);
    setPendingAiProposal(null);
    setSelectedArtifact(null);
    setArtifactId("");
    setDraftTemplate(template);
    setEditorSession((value) => value + 1);
    setTemplateModalOpen(false);
  };

  const syncWorkspaceArtifact = (id: string, artifact?: ArtifactResponse) => {
    setArtifactId(id);
    if (artifact) {
      setSelectedArtifact(artifact);
      setDraftTemplate(null);
    }
  };

  const deleteWorkspaceArtifact = (id: string) => {
    setActiveDocument(null);
    setAiDocumentUpdate(null);
    setPendingAiProposal(null);
    setArtifacts((items) => items.filter((item) => item.artifact_id !== id));
    setArtifactId("");
    setSelectedArtifact(null);
    setDraftTemplate(null);
    setEditorSession((value) => value + 1);
  };

  const applyAiDocumentChange = (targetArtifactId: string, content: string): boolean => {
    const target = artifacts.find((artifact) => artifact.artifact_id === targetArtifactId);
    if (!target) return false;
    if (activeDocument?.documentKey === targetArtifactId) {
      setAiDocumentUpdate((current) => ({
        documentKey: targetArtifactId,
        content,
        requestId: (current?.requestId ?? 0) + 1,
      }));
      return true;
    }
    setPendingAiProposal({ targetArtifactId, content });
    setActiveDocument(null);
    setAiDocumentUpdate(null);
    setDraftTemplate(null);
    setSelectedArtifact(target);
    setArtifactId(targetArtifactId);
    return true;
  };

  return (
    <main className="app-shell">
      <ProjectSidebar
        api={api}
        activeProjectId={projectId}
        activeProjectName={selectedProject?.name ?? ""}
        artifacts={artifacts}
        loadingArtifacts={loadingArtifacts}
        artifactProblem={artifactListProblem}
        activeArtifactId={artifactId}
        onSelectProject={selectProject}
        onProjectUpdated={setSelectedProject}
        onSelectArtifact={selectArtifact}
        onNewArtifact={startNewArtifact}
        onLogout={onLogout}
      />
      <section className="application-pane">
        <div className="workspace-content">
          {!projectId ? (
            <section className="project-welcome" data-testid="project-selection-prompt">
              <div className="welcome-illustration" aria-hidden="true">
                <div className="welcome-folder">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <p className="section-kicker">PROJECT WORKSPACE</p>
              <h1>왼쪽에서 프로젝트를 선택하세요</h1>
              <p>
                프로젝트 선택 창에서 작업 대상을 고르면 같은 사이드바에 산출물 목록이 표시됩니다.
              </p>
            </section>
          ) : (
            <div className="project-page">
              <div className="document-workspace-layout">
                {selectedArtifact || draftTemplate ? (
                  <ArtifactWorkspace
                    key={`${projectId}:${selectedArtifact?.artifact_id ?? `${draftTemplate?.templateId}-${editorSession}`}`}
                    api={api}
                    projectId={projectId}
                    projectInformation={selectedProject}
                    initialArtifact={selectedArtifact}
                    initialTemplate={draftTemplate}
                    artifacts={artifacts}
                    loadingArtifacts={loadingArtifacts}
                    listProblem={artifactListProblem}
                    onArtifactsChange={setArtifacts}
                    onArtifact={syncWorkspaceArtifact}
                    onDeleted={deleteWorkspaceArtifact}
                    onDocumentContextChange={setActiveDocument}
                    aiDocumentUpdate={aiDocumentUpdate}
                  />
                ) : (
                  <section className="template-start-empty">
                    <div className="template-start-icon">+</div>
                    <h2>새 산출물을 만들거나 기존 문서를 선택하세요</h2>
                    <p>
                      AI에게 프로젝트를 질문하거나, 새 산출물은 템플릿을 선택해 작성할 수 있습니다.
                    </p>
                    <button className="primary-button" onClick={() => setTemplateModalOpen(true)}>
                      산출물 템플릿 선택
                    </button>
                  </section>
                )}
                <AiWorkspacePanel
                  key={`${projectId}:ai`}
                  api={api}
                  projectId={projectId}
                  activeDocument={activeDocument}
                  onApplyDocumentChange={applyAiDocumentChange}
                />
              </div>
            </div>
          )}
        </div>
      </section>
      <TemplateSelectionModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={selectTemplate}
      />
    </main>
  );
}

export default function App() {
  const [access, setAccess] = useState<RuntimeAccess | null>(() => localAutoLoginAccess ?? null);
  const [session, setSession] = useState(0);
  const establishAccess = (value: RuntimeAccess | null) => {
    setAccess(value);
    setSession((current) => current + 1);
  };
  if (!access) return <LoginScreen onLogin={establishAccess} />;
  return (
    <ProjectProvider key={session}>
      <Workspace access={access} onLogout={() => establishAccess(localAutoLoginAccess ?? null)} />
    </ProjectProvider>
  );
}
