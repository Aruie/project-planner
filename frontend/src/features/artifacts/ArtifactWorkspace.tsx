import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import {
  ApiProblem,
  type ArtifactDetailResponse,
  type ArtifactResponse,
  type VersionResponse,
} from "../../shared/api/models";
import { BlockingProgress, SafeFeedback } from "../../shared/ui/SafeFeedback";
import { GenericDocumentView } from "./GenericDocumentView";
import {
  ManagedDocumentFactory,
  RequirementsDefinitionDocument,
  SpreadsheetDocument,
} from "./document-model";
import { RequirementsDocumentView } from "./RequirementsDocumentView";
import { SpreadsheetDocumentView } from "./SpreadsheetDocumentView";
import { type TemplateDraft } from "./document-templates";
import { TraceabilityPanel } from "../traceability/TraceabilityPanel";
import { VersionCreationModal } from "./VersionCreationModal";
import { VersionDiffPanel } from "./VersionDiffPanel";

type DocumentView = "information" | "preview" | "source" | "versions";

type Props = {
  api: ApiClient;
  projectId: string;
  initialArtifact?: ArtifactResponse | null;
  initialTemplate?: TemplateDraft | null;
  artifacts: ArtifactResponse[];
  loadingArtifacts: boolean;
  listProblem: ApiProblem | null;
  onArtifactsChange: (items: ArtifactResponse[]) => void;
  onArtifact: (id: string, artifact?: ArtifactResponse) => void;
};

export function ArtifactWorkspace({
  api,
  projectId,
  initialArtifact = null,
  initialTemplate = null,
  artifacts,
  onArtifactsChange,
  onArtifact,
}: Props) {
  const [artifact, setArtifact] = useState<ArtifactResponse | null>(initialArtifact);
  const [title, setTitle] = useState(initialArtifact?.title ?? initialTemplate?.title ?? "");
  const [savedTitle, setSavedTitle] = useState(initialArtifact?.title ?? "");
  const [content, setContent] = useState(initialTemplate?.content ?? "");
  const [savedContent, setSavedContent] = useState("");
  const [kind, setKind] = useState<"MarkdownDocument" | "ExcelDocument">(
    initialArtifact?.artifact_type ?? initialTemplate?.artifactType ?? "MarkdownDocument",
  );
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(initialArtifact));
  const [documentView, setDocumentView] = useState<DocumentView>("information");
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState<VersionResponse | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const documentModel = useMemo(
    () => ManagedDocumentFactory.create(content, kind),
    [content, kind],
  );
  const canCreate = Boolean(projectId && !artifact && title.trim() && !pending);
  const canSave = Boolean(artifact && title.trim() && content.trim() && !pending && !loadingDetail);
  const hasUnsavedChanges = Boolean(artifact && (content !== savedContent || title !== savedTitle));

  const updateContent = (value: string) => {
    setContent(value);
    if (!artifact) {
      const resolved = ManagedDocumentFactory.create(value, kind);
      if (resolved.title) setTitle(resolved.title);
    }
  };

  const initialArtifactId = initialArtifact?.artifact_id;
  useEffect(() => {
    if (!initialArtifactId) return;
    const controller = new AbortController();

    void api
      .get<ArtifactDetailResponse>(
        `/projects/${projectId}/artifacts/${initialArtifactId}`,
        controller.signal,
      )
      .then((detail) => {
        setArtifact(detail);
        setTitle(detail.title);
        setSavedTitle(detail.title);
        setContent(detail.content ?? "");
        setSavedContent(detail.content ?? "");
        setKind(detail.artifact_type);
        setDocumentView("information");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "DETAIL_LOAD_FAILED",
                message: "Draft 원문을 불러오지 못했습니다.",
                retryable: true,
              }),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false);
      });

    void api
      .get<VersionResponse[]>(
        `/projects/${projectId}/artifacts/${initialArtifactId}/versions`,
        controller.signal,
      )
      .then((versions) =>
        setLatestVersion(
          [...versions].sort((a, b) => b.version_number - a.version_number)[0] ?? null,
        ),
      )
      .catch(() => {
        if (!controller.signal.aborted) setLatestVersion(null);
      });

    return () => controller.abort();
  }, [api, initialArtifactId, projectId]);

  const importDocument = async (file?: File) => {
    if (!file) return;
    const source = await file.text();
    const document = ManagedDocumentFactory.create(source);
    setArtifact(null);
    setKind("MarkdownDocument");
    setTitle(document.title || file.name.replace(/\.[^.]+$/, ""));
    setContent(source);
    setProblem(null);
    onArtifact("");
  };

  const run = async (operation: "create" | "save") => {
    if (!projectId || !title.trim()) return;
    setPending(true);
    setProblem(null);
    try {
      const result =
        operation === "create"
          ? await api.post<ArtifactResponse>(`/projects/${projectId}/artifacts`, {
              metadata: { title: title.trim(), artifact_type: kind },
              content,
            })
          : await api.put<ArtifactResponse>(
              `/projects/${projectId}/artifacts/${artifact?.artifact_id}/draft`,
              {
                expected_revision: artifact?.revision,
                title: title.trim(),
                description: artifact?.description ?? "",
                tags: artifact?.tags ?? [],
                content,
              },
            );
      setArtifact(result);
      setSavedTitle(result.title);
      setSavedContent(content);
      onArtifactsChange([
        ...artifacts.filter((item) => item.artifact_id !== result.artifact_id),
        result,
      ]);
      onArtifact(result.artifact_id, result);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "NETWORK_ERROR",
              message: "Draft를 저장하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setPending(false);
    }
  };

  const generateFile = async () => {
    if (!artifact || exporting) return;
    setExporting(true);
    setProblem(null);
    try {
      const safeTitle = (title.trim() || "document").replace(/[\\/:*?"<>|]+/g, "-");
      const path = `/projects/${projectId}/artifacts/${artifact.artifact_id}/exports/${kind === "MarkdownDocument" ? "docx" : "xlsx"}`;
      const body =
        kind === "MarkdownDocument"
          ? { markdown: content, filename: `${safeTitle}.docx` }
          : {
              model: {
                cover: {
                  public_document_id: artifact.public_document_id,
                  title: title.trim(),
                  description: artifact.description ?? "",
                  artifact_type: artifact.artifact_type,
                },
                change_history: latestVersion
                  ? [
                      {
                        version_number: latestVersion.version_number,
                        source_draft_revision: artifact.revision,
                      },
                    ]
                  : [],
                body_blocks:
                  documentModel instanceof SpreadsheetDocument
                    ? documentModel.workbook.sheets.map((sheet) => ({
                        kind: "table",
                        content: sheet.name,
                        rows: [
                          sheet.columns.map((column) => column.label),
                          ...sheet.rows.map((row) =>
                            sheet.columns.map((column) => String(row[column.key] ?? "")),
                          ),
                        ],
                      }))
                    : [{ kind: "paragraph", content, rows: [] }],
                attachment_ids: [],
              },
              template_kind: "GenericExcel",
            };
      const result = await api.download(path, body);
      const href = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = href;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "EXPORT_FAILED",
              message: "파일을 생성하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setExporting(false);
    }
  };

  const requirementIds =
    documentModel instanceof RequirementsDefinitionDocument
      ? documentModel.requirements.map((requirement) => requirement.id).filter(Boolean)
      : [];

  return (
    <section className="artifact-workspace">
      <div className="draft-panel">
        <header className="draft-panel-header document-command-bar">
          <div className="document-heading">
            <div className="draft-mode">
              <span>{artifact ? "DOCUMENT" : "NEW DOCUMENT"}</span>
            </div>
            <div className="document-title-line">
              <h2>{artifact ? artifact.title : "새 산출물 작성"}</h2>
              {artifact ? (
                <strong className="revision-badge">REVISION {artifact.revision}</strong>
              ) : null}
              {latestVersion ? (
                <span className="version-badge">v{latestVersion.version_number}</span>
              ) : null}
            </div>
          </div>
          <div className="draft-actions">
            {!artifact ? (
              <>
                <label className="import-document-button">
                  문서 불러오기
                  <input
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={(event) => void importDocument(event.target.files?.[0])}
                  />
                </label>
                <button
                  className="primary-button"
                  data-testid="artifact-create-button"
                  disabled={!canCreate}
                  onClick={() => void run("create")}
                >
                  산출물 생성
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondary-button"
                  data-testid="artifact-save-button"
                  disabled={!canSave}
                  onClick={() => void run("save")}
                >
                  임시저장
                </button>
                <button
                  className="primary-button"
                  disabled={hasUnsavedChanges || pending}
                  title={hasUnsavedChanges ? "변경 내용을 먼저 임시저장하세요." : undefined}
                  onClick={() => setVersionModalOpen(true)}
                >
                  새 버전 생성
                </button>
                <button
                  className="file-generate-button"
                  disabled={loadingDetail || exporting}
                  onClick={() => void generateFile()}
                >
                  {exporting ? "파일 생성 중…" : "파일 생성"}
                </button>
              </>
            )}
          </div>
        </header>

        <nav className="workspace-document-tabs" aria-label="문서 작업 메뉴">
          {(
            [
              ["information", "문서정보"],
              ["preview", "미리보기"],
              ["source", "원문편집"],
              ["versions", "버전정보"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={documentView === value ? "active" : ""}
              disabled={value === "versions" && !artifact}
              onClick={() => setDocumentView(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="draft-form">
          <div className="draft-form-row">
            <label className="document-type-field">
              <span>산출물 형식</span>
              <select
                data-testid="artifact-type-select"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                disabled={!projectId || Boolean(artifact) || Boolean(initialTemplate)}
              >
                <option value="MarkdownDocument">Word 문서 (.docx)</option>
                <option value="ExcelDocument">Excel 문서 (.xlsx)</option>
              </select>
            </label>
            <label className="document-title-field">
              <span>제목</span>
              <input
                data-testid="artifact-title-input"
                placeholder="산출물 제목을 입력하세요"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={!projectId}
              />
            </label>
          </div>

          {loadingDetail ? (
            <div className="document-loading" role="status" aria-live="polite">
              <span className="document-spinner" aria-hidden="true" />
              <strong>문서를 불러오는 중입니다</strong>
              <span>Draft 원문과 버전 정보를 준비하고 있습니다.</span>
            </div>
          ) : documentView === "versions" && artifact ? (
            <VersionDiffPanel api={api} projectId={projectId} artifactId={artifact.artifact_id} />
          ) : (
            <>
              {documentModel.kind === "structured-spreadsheet" ? (
                <SpreadsheetDocumentView
                  content={content}
                  onContentChange={updateContent}
                  disabled={!projectId}
                  activeView={
                    documentView === "information"
                      ? "information"
                      : documentView === "preview"
                        ? "sheet"
                        : "source"
                  }
                  showNavigation={false}
                />
              ) : documentModel.kind === "requirements-definition" ? (
                <RequirementsDocumentView
                  content={content}
                  onContentChange={updateContent}
                  disabled={!projectId}
                  activeView={
                    documentView === "information"
                      ? "document"
                      : documentView === "preview"
                        ? "requirements"
                        : "source"
                  }
                  showNavigation={false}
                />
              ) : content.trim() && (documentModel.hasFrontMatter || Boolean(artifact)) ? (
                <GenericDocumentView
                  content={content}
                  onContentChange={updateContent}
                  disabled={!projectId}
                  activeView={
                    documentView === "information"
                      ? "information"
                      : documentView === "preview"
                        ? "preview"
                        : "source"
                  }
                  showNavigation={false}
                />
              ) : documentView === "source" ? (
                <label className="document-content-field">
                  <span>Markdown 본문</span>
                  <textarea
                    data-testid="artifact-content-input"
                    aria-label="Markdown 본문"
                    placeholder={artifact ? "Draft 본문을 입력하세요." : "문서 본문을 입력하세요."}
                    value={content}
                    onChange={(event) => updateContent(event.target.value)}
                    disabled={!projectId}
                  />
                </label>
              ) : (
                <div className="document-empty-view">
                  <strong>
                    {documentView === "information"
                      ? "문서 정보가 없습니다."
                      : "미리볼 내용이 없습니다."}
                  </strong>
                  <span>원문편집에서 문서 내용을 입력하세요.</span>
                </div>
              )}

              {documentView === "information" &&
              documentModel.kind === "requirements-definition" ? (
                <TraceabilityPanel
                  api={api}
                  projectId={projectId}
                  requirementIds={requirementIds}
                />
              ) : null}
            </>
          )}
        </div>

        <footer className="draft-panel-footer">
          <span>{content.length.toLocaleString()}자</span>
          <span>{kind === "MarkdownDocument" ? "Word · DOCX" : "Excel · XLSX"}</span>
        </footer>
        <SafeFeedback problem={problem} />
        {problem?.currentRevision ? (
          <p className="draft-conflict-banner" data-testid="draft-conflict-banner">
            서버의 현재 revision은 {problem.currentRevision}입니다. 입력 내용은 유지됩니다.
          </p>
        ) : null}
      </div>
      {artifact && versionModalOpen ? (
        <VersionCreationModal
          open={versionModalOpen}
          api={api}
          projectId={projectId}
          artifactId={artifact.artifact_id}
          onClose={() => setVersionModalOpen(false)}
          onCreated={setLatestVersion}
        />
      ) : null}
      <BlockingProgress
        active={pending || exporting}
        title={
          exporting
            ? "파일을 생성하고 있습니다"
            : artifact
              ? "임시저장 중입니다"
              : "산출물을 생성하고 있습니다"
        }
        description="완료될 때까지 현재 화면에서 잠시 기다려 주세요."
      />
    </section>
  );
}
