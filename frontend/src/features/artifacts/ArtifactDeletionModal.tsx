import { useEffect, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem } from "../../shared/api/models";
import { BlockingProgress, SafeFeedback } from "../../shared/ui/SafeFeedback";

export function ArtifactDeletionModal({
  open,
  api,
  projectId,
  artifactId,
  publicDocumentId,
  title,
  onClose,
  onDeleted,
}: {
  open: boolean;
  api: ApiClient;
  projectId: string;
  artifactId: string;
  publicDocumentId: string;
  title: string;
  onClose: () => void;
  onDeleted: (artifactId: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const confirmed = confirmation === title;

  useEffect(() => {
    if (!open || deleting) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, deleting, onClose]);

  if (!open) return null;

  const deleteArtifact = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setProblem(null);
    try {
      await api.delete(`/projects/${projectId}/artifacts/${artifactId}`, {
        confirmation_title: confirmation,
      });
      onDeleted(artifactId);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "ARTIFACT_DELETE_FAILED",
              message: "문서를 삭제하지 못했습니다.",
              retryable: true,
            }),
      );
      setDeleting(false);
    }
  };

  return (
    <div
      className="version-modal-backdrop deletion-modal-backdrop"
      onMouseDown={() => !deleting && onClose()}
    >
      <section
        className="version-modal artifact-deletion-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="artifact-deletion-title"
        aria-describedby="artifact-deletion-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>PERMANENT DELETION</p>
            <h2 id="artifact-deletion-title">문서를 영구 삭제하시겠습니까?</h2>
            <span id="artifact-deletion-description">이 작업은 완료 후 되돌릴 수 없습니다.</span>
          </div>
          <button onClick={onClose} aria-label="닫기" disabled={deleting}>
            <svg viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="version-modal-body deletion-modal-body">
          <div className="deletion-document-identity">
            <span>{publicDocumentId}</span>
            <strong>{title}</strong>
          </div>
          <div className="deletion-warning">
            <strong>다음 데이터가 모두 삭제됩니다.</strong>
            <ul>
              <li>현재 Draft와 문서 정보</li>
              <li>모든 immutable version과 개정이력</li>
              <li>문서에 첨부된 모든 파일</li>
            </ul>
          </div>
          <label className="deletion-confirmation-field">
            <span>확인을 위해 문서 제목을 정확히 입력하세요.</span>
            <code>{title}</code>
            <input
              autoFocus
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={deleting}
              aria-invalid={Boolean(confirmation) && !confirmed}
              placeholder="문서 제목 입력"
            />
          </label>
          <SafeFeedback problem={problem} />
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose} disabled={deleting}>
            취소
          </button>
          <button
            className="danger-button"
            disabled={!confirmed || deleting}
            onClick={() => void deleteArtifact()}
          >
            {deleting ? "삭제 중…" : "영구 삭제"}
          </button>
        </footer>
      </section>
      <BlockingProgress
        active={deleting}
        title="문서를 영구 삭제하고 있습니다"
        description="Draft, 모든 버전과 첨부 파일을 정리하는 중입니다."
      />
    </div>
  );
}
