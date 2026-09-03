import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import {
  ApiProblem,
  type ArtifactDetailResponse,
  type ArtifactResponse,
  type ProjectSummary,
  type VersionResponse,
} from "../../shared/api/models";
import { BlockingProgress, SafeFeedback } from "../../shared/ui/SafeFeedback";
import type { ActiveDocumentContext, AiDocumentUpdate } from "../ai-workspace/document-bridge";
import { ArtifactDeletionModal } from "./ArtifactDeletionModal";
import { GenericDocumentView } from "./GenericDocumentView";
import {
  ManagedDocumentFactory,
  RequirementsDefinitionDocument,
  SpreadsheetDocument,
  stripDocumentMetadata,
  synchronizeDocumentTitle,
} from "./document-model";
import { FileGenerationModal } from "./FileGenerationModal";
import { defaultPdfFilename } from "./file-generation";
import { RequirementsDocumentView } from "./RequirementsDocumentView";
import { SpreadsheetDocumentView } from "./SpreadsheetDocumentView";
import { type TemplateDraft } from "./document-templates";
import { TraceabilityPanel } from "../traceability/TraceabilityPanel";
import { VersionCreationModal } from "./VersionCreationModal";
import { VersionDiffPanel } from "./VersionDiffPanel";

type DocumentView = "information" | "preview" | "source" | "versions" | "traceability";

type Props = {
  api: ApiClient;
  projectId: string;
  projectInformation: ProjectSummary | null;
  initialArtifact?: ArtifactResponse | null;
  initialTemplate?: TemplateDraft | null;
  artifacts: ArtifactResponse[];
  loadingArtifacts: boolean;
  listProblem: ApiProblem | null;
  onArtifactsChange: (items: ArtifactResponse[]) => void;
  onArtifact: (id: string, artifact?: ArtifactResponse) => void;
  onDeleted: (artifactId: string) => void;
  onDocumentContextChange: (document: ActiveDocumentContext) => void;
  aiDocumentUpdate: AiDocumentUpdate | null;
};

export function ArtifactWorkspace({
  api,
  projectId,
  projectInformation,
  initialArtifact = null,
  initialTemplate = null,
  artifacts,
  onArtifactsChange,
  onArtifact,
  onDeleted,
  onDocumentContextChange,
  aiDocumentUpdate,
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
  const [documentView, setDocumentView] = useState<DocumentView>("preview");
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [titleEditorOpen, setTitleEditorOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [fileGenerationOpen, setFileGenerationOpen] = useState(false);
  const [pdfFilename, setPdfFilename] = useState("");
  const [latestVersion, setLatestVersion] = useState<VersionResponse | null>(null);
  const [versions, setVersions] = useState<VersionResponse[]>([]);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveInFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const documentModel = useMemo(
    () => ManagedDocumentFactory.create(content, kind),
    [content, kind],
  );
  const canCreate = Boolean(projectId && !artifact && title.trim() && !pending);
  const hasUnsavedChanges = Boolean(artifact && (content !== savedContent || title !== savedTitle));
  const documentKey = artifact?.artifact_id ?? `new:${initialTemplate?.templateId ?? "document"}`;

  const updateContent = (value: string) => {
    setContent(value);
    if (!artifact) {
      const resolved = ManagedDocumentFactory.create(value, kind);
      if (resolved.title) setTitle(resolved.title);
    }
  };

  const updateTitle = (value: string) => {
    setTitle(value);
    setContent((current) => synchronizeDocumentTitle(current, kind, value));
  };

  const openTitleEditor = () => {
    setTitleDraft(title);
    setTitleEditorOpen(true);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next) return;
    updateTitle(next);
    setTitleEditorOpen(false);
  };

  const openFileGeneration = () => {
    setPdfFilename(defaultPdfFilename(title, latestVersion?.version_number ?? 1));
    setFileGenerationOpen(true);
  };

  useEffect(() => {
    if (loadingDetail) return;
    onDocumentContextChange({
      documentKey,
      title,
      artifactType: kind,
      content,
      persisted: Boolean(artifact),
    });
  }, [artifact, content, documentKey, kind, loadingDetail, onDocumentContextChange, title]);

  /* eslint-disable react-hooks/set-state-in-effect -- approved AI updates are external editor events */
  useEffect(() => {
    if (!aiDocumentUpdate || aiDocumentUpdate.documentKey !== documentKey) return;
    setContent(synchronizeDocumentTitle(aiDocumentUpdate.content, kind, title));
    setDocumentView("preview");
    setProblem(null);
  }, [aiDocumentUpdate, documentKey, kind, title]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        const storedContent = detail.content ?? "";
        const normalizedContent =
          detail.artifact_type === "MarkdownDocument"
            ? stripDocumentMetadata(storedContent)
            : storedContent;
        setContent(normalizedContent);
        setSavedContent(storedContent);
        setKind(detail.artifact_type);
        setDocumentView("preview");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "DETAIL_LOAD_FAILED",
                message: "문서 원문을 불러오지 못했습니다.",
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
      .then((items) => {
        const ordered = [...items].sort((a, b) => b.version_number - a.version_number);
        setVersions(ordered);
        setLatestVersion(ordered[0] ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setVersions([]);
          setLatestVersion(null);
        }
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
    setContent(stripDocumentMetadata(source));
    setProblem(null);
    onArtifact("");
  };

  const createArtifact = async () => {
    if (!projectId || !title.trim()) return;
    const synchronizedContent = synchronizeDocumentTitle(content, kind, title.trim());
    setPending(true);
    setProblem(null);
    try {
      const result = await api.post<ArtifactResponse>(`/projects/${projectId}/artifacts`, {
        metadata: { title: title.trim(), artifact_type: kind },
        content: synchronizedContent,
      });
      setArtifact(result);
      setSavedTitle(result.title);
      setContent(synchronizedContent);
      setSavedContent(synchronizedContent);
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
              message: "산출물을 생성하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setPending(false);
    }
  };

  const saveDraft = useCallback(
    async (
      currentArtifact: ArtifactResponse,
      snapshotTitle: string,
      snapshotContent: string,
      snapshotKind: "MarkdownDocument" | "ExcelDocument",
    ) => {
      if (autoSaveInFlight.current) return;
      autoSaveInFlight.current = true;
      setAutoSaving(true);
      setProblem(null);
      const synchronizedContent = synchronizeDocumentTitle(
        snapshotContent,
        snapshotKind,
        snapshotTitle.trim(),
      );
      try {
        const result = await api.put<ArtifactResponse>(
          `/projects/${projectId}/artifacts/${currentArtifact.artifact_id}/draft`,
          {
            expected_revision: currentArtifact.revision,
            title: snapshotTitle.trim(),
            description: currentArtifact.description ?? "",
            tags: currentArtifact.tags ?? [],
            content: synchronizedContent,
          },
        );
        if (!mounted.current) return;
        setArtifact(result);
        setSavedTitle(result.title);
        setSavedContent(synchronizedContent);
        setContent((current) =>
          current === snapshotContent || current === synchronizedContent
            ? synchronizedContent
            : current,
        );
        onArtifactsChange([
          ...artifacts.filter((item) => item.artifact_id !== result.artifact_id),
          result,
        ]);
        onArtifact(result.artifact_id, result);
      } catch (error) {
        if (!mounted.current) return;
        setProblem(
          error instanceof ApiProblem
            ? error
            : new ApiProblem({
                code: "AUTOSAVE_FAILED",
                message: "변경 내용을 자동 저장하지 못했습니다.",
                retryable: true,
              }),
        );
      } finally {
        autoSaveInFlight.current = false;
        if (mounted.current) setAutoSaving(false);
      }
    },
    [api, artifacts, onArtifact, onArtifactsChange, projectId],
  );

  useEffect(() => {
    if (
      !artifact ||
      !hasUnsavedChanges ||
      loadingDetail ||
      pending ||
      exporting ||
      !title.trim() ||
      autoSaveInFlight.current
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void saveDraft(artifact, title, content, kind);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    artifact,
    content,
    exporting,
    hasUnsavedChanges,
    kind,
    loadingDetail,
    pending,
    saveDraft,
    title,
  ]);

  const generateFile = async () => {
    if (!artifact || exporting) return;
    const baseName = pdfFilename
      .trim()
      .replace(/\.pdf$/i, "")
      .replace(/[\\/:*?"<>|]+/g, "_");
    if (!baseName) return;
    setExporting(true);
    setProblem(null);
    try {
      const renderModel = {
        cover: {
          public_document_id: artifact.public_document_id,
          title: title.trim(),
          description: artifact.description ?? "",
          artifact_type: artifact.artifact_type,
          task_name: projectInformation?.task_name || projectInformation?.name || "",
          contractor_name: projectInformation?.contractor_name ?? "",
          client_name: projectInformation?.client_name ?? "",
          organization_name: projectInformation?.organization_name ?? "",
        },
        change_history: versions.map((version) => ({
          version_number: version.version_number,
          source_draft_revision: version.source_draft_revision,
        })),
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
            : [],
        attachment_ids: [],
      };
      const result = await api.download(
        `/projects/${projectId}/artifacts/${artifact.artifact_id}/exports/pdf`,
        {
          model: renderModel,
          markdown: kind === "MarkdownDocument" ? content : "",
          filename: `${baseName}.pdf`,
        },
      );
      const href = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = href;
      anchor.download = result.filename.endsWith(".pdf") ? result.filename : `${baseName}.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      setFileGenerationOpen(false);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "PDF_EXPORT_FAILED",
              message: "PDF 파일을 생성하지 못했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setExporting(false);
    }
  };

  const recordCreatedVersion = (version: VersionResponse) => {
    setLatestVersion(version);
    setVersions((current) =>
      [version, ...current.filter((item) => item.version_id !== version.version_id)].sort(
        (a, b) => b.version_number - a.version_number,
      ),
    );
  };

  const isRequirementsDocument =
    documentModel instanceof RequirementsDefinitionDocument ||
    (documentModel instanceof SpreadsheetDocument &&
      documentModel.workbook.templateId === "requirements-definition");
  const requirementIds =
    documentModel instanceof RequirementsDefinitionDocument
      ? documentModel.requirements.map((requirement) => requirement.id).filter(Boolean)
      : documentModel instanceof SpreadsheetDocument &&
          documentModel.workbook.templateId === "requirements-definition"
        ? documentModel.workbook.sheets.flatMap((sheet) =>
            sheet.rows.map((row) => String(row.requirement_id ?? "")).filter(Boolean),
          )
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
              {titleEditorOpen ? (
                <form
                  className="document-title-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitTitle();
                  }}
                >
                  <input
                    autoFocus
                    data-testid="artifact-title-input"
                    aria-label="문서 제목"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    disabled={!projectId || pending || autoSaving}
                  />
                  <button
                    type="submit"
                    className="title-editor-save"
                    aria-label="제목 저장"
                    disabled={!titleDraft.trim()}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="title-editor-cancel"
                    aria-label="제목 수정 취소"
                    onClick={() => setTitleEditorOpen(false)}
                  >
                    취소
                  </button>
                </form>
              ) : (
                <>
                  <h2>{title || "새 산출물 작성"}</h2>
                  <button
                    type="button"
                    className="document-title-edit-button"
                    data-testid="artifact-title-edit-button"
                    aria-label="문서 제목 수정"
                    title="문서 제목 수정"
                    disabled={!projectId || pending || autoSaving}
                    onClick={openTitleEditor}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m4 16-.8 4.8L8 20l10.6-10.6a2.1 2.1 0 0 0 0-3L17.6 5a2.1 2.1 0 0 0-3 0L4 16Z" />
                      <path d="m13.5 6.5 4 4" />
                    </svg>
                  </button>
                </>
              )}
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
                  onClick={() => void createArtifact()}
                >
                  산출물 생성
                </button>
              </>
            ) : (
              <>
                <span
                  className={`autosave-status ${autoSaving ? "saving" : hasUnsavedChanges ? "waiting" : "saved"}`}
                  role="status"
                  aria-live="polite"
                >
                  {autoSaving
                    ? "자동 저장 중…"
                    : hasUnsavedChanges
                      ? "자동 저장 대기 중"
                      : "자동 저장됨"}
                </span>
                <button
                  className="primary-button"
                  disabled={hasUnsavedChanges || autoSaving || pending}
                  title={hasUnsavedChanges ? "자동 저장이 완료될 때까지 기다려주세요." : undefined}
                  onClick={() => setVersionModalOpen(true)}
                >
                  새 버전 생성
                </button>
                <button
                  className="file-generate-button"
                  disabled={loadingDetail || exporting || autoSaving}
                  onClick={openFileGeneration}
                >
                  PDF 생성
                </button>
                <button
                  className="delete-document-button"
                  disabled={pending || exporting || autoSaving}
                  onClick={() => setDeletionModalOpen(true)}
                >
                  문서 삭제
                </button>
              </>
            )}
          </div>
        </header>

        <nav className="workspace-document-tabs" aria-label="문서 작업 메뉴">
          {[
            ...(artifact ? ([["information", "개정이력"]] as const) : []),
            ...([
              ["preview", "미리보기"],
              ["source", "원문편집"],
            ] as const),
            ...(isRequirementsDocument ? ([["traceability", "요구사항 ↔ 테스트"]] as const) : []),
            ...(artifact ? ([["versions", "버전비교"]] as const) : []),
          ].map(([value, label]) => (
            <button
              key={value}
              className={documentView === value ? "active" : ""}
              onClick={() => setDocumentView(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="draft-form">
          {loadingDetail ? (
            <div className="document-loading" role="status" aria-live="polite">
              <span className="document-spinner" aria-hidden="true" />
              <strong>문서를 불러오는 중입니다</strong>
              <span>문서 원문과 버전 정보를 준비하고 있습니다.</span>
            </div>
          ) : documentView === "information" && artifact ? (
            <ActualVersionHistory versions={versions} />
          ) : documentView === "versions" && artifact ? (
            <VersionDiffPanel api={api} projectId={projectId} artifactId={artifact.artifact_id} />
          ) : documentView === "traceability" && isRequirementsDocument ? (
            <TraceabilityPanel api={api} projectId={projectId} requirementIds={requirementIds} />
          ) : documentModel.kind === "structured-spreadsheet" ? (
            <SpreadsheetDocumentView
              content={content}
              onContentChange={updateContent}
              disabled={!projectId}
              activeView={documentView === "preview" ? "sheet" : "source"}
              showNavigation={false}
            />
          ) : documentModel.kind === "requirements-definition" ? (
            <RequirementsDocumentView
              content={content}
              onContentChange={updateContent}
              disabled={!projectId}
              activeView={documentView === "preview" ? "requirements" : "source"}
              showNavigation={false}
            />
          ) : content.trim() ? (
            <GenericDocumentView
              content={content}
              onContentChange={updateContent}
              disabled={!projectId}
              activeView={documentView === "preview" ? "preview" : "source"}
              showNavigation={false}
              documentTitle={title}
              projectInformation={projectInformation}
            />
          ) : documentView === "source" ? (
            <label className="document-content-field">
              <span>Markdown 본문</span>
              <textarea
                data-testid="artifact-content-input"
                aria-label="Markdown 본문"
                placeholder={artifact ? "문서 본문을 입력하세요." : "문서 내용을 입력하세요."}
                value={content}
                onChange={(event) => updateContent(event.target.value)}
                disabled={!projectId}
              />
            </label>
          ) : (
            <div className="document-empty-view">
              <strong>미리볼 내용이 없습니다.</strong>
              <span>원문편집에서 문서 내용을 입력하세요.</span>
            </div>
          )}
        </div>

        <footer className="draft-panel-footer">
          <span>{content.length.toLocaleString()}자</span>
        </footer>
        <SafeFeedback problem={problem} />
        {problem?.currentRevision ? (
          <p className="draft-conflict-banner" data-testid="draft-conflict-banner">
            서버의 현재 revision은 {problem.currentRevision}입니다. 입력 내용은 유지됩니다.
          </p>
        ) : null}
      </div>
      <FileGenerationModal
        open={Boolean(artifact && fileGenerationOpen)}
        filename={pdfFilename}
        generating={exporting}
        onFilenameChange={setPdfFilename}
        onClose={() => setFileGenerationOpen(false)}
        onGenerate={() => void generateFile()}
      />
      {artifact && versionModalOpen ? (
        <VersionCreationModal
          open={versionModalOpen}
          api={api}
          projectId={projectId}
          artifactId={artifact.artifact_id}
          onClose={() => setVersionModalOpen(false)}
          onCreated={recordCreatedVersion}
        />
      ) : null}
      {artifact && deletionModalOpen ? (
        <ArtifactDeletionModal
          open={deletionModalOpen}
          api={api}
          projectId={projectId}
          artifactId={artifact.artifact_id}
          publicDocumentId={artifact.public_document_id}
          title={savedTitle}
          onClose={() => setDeletionModalOpen(false)}
          onDeleted={onDeleted}
        />
      ) : null}
      <BlockingProgress
        active={pending || exporting}
        title={exporting ? "PDF를 생성하고 있습니다" : "산출물을 생성하고 있습니다"}
        description="완료될 때까지 현재 화면에서 잠시 기다려 주세요."
      />
    </section>
  );
}

function ActualVersionHistory({ versions }: { versions: VersionResponse[] }) {
  return (
    <section className="actual-version-history" aria-labelledby="actual-version-history-title">
      <header>
        <div>
          <span>VERSION HISTORY</span>
          <h3 id="actual-version-history-title">개정이력</h3>
          <p>새 버전을 만들 때 확정한 문서 기록입니다.</p>
        </div>
        <strong>{versions.length}개 버전</strong>
      </header>
      {versions.length ? (
        <div className="actual-version-list">
          {versions.map((version) => {
            const createdAt = new Date(version.created_at);
            const hasCreatedAt =
              !Number.isNaN(createdAt.getTime()) && createdAt.getUTCFullYear() > 1970;
            return (
              <article key={version.version_id}>
                <span className="history-version">v{version.version_number}</span>
                <div>
                  <strong>{version.change_summary || "변경 메시지 없음"}</strong>
                  <p>{version.title}</p>
                </div>
                <div className="actual-version-meta">
                  <span>저장 기준 {version.source_draft_revision}차 수정본</span>
                  <time dateTime={hasCreatedAt ? version.created_at : undefined}>
                    {hasCreatedAt ? createdAt.toLocaleString("ko-KR") : "생성 시각 정보 없음"}
                  </time>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="actual-version-empty">아직 생성된 버전이 없습니다.</div>
      )}
    </section>
  );
}
