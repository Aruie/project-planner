import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem } from "../../shared/api/models";
import { SafeFeedback } from "../../shared/ui/SafeFeedback";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const asBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function RenderingPanel({
  api,
  projectId,
  artifactId,
}: {
  api: ApiClient;
  projectId: string;
  artifactId: string;
}) {
  const [markdown, setMarkdown] = useState("");
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const ready = Boolean(projectId && artifactId);
  const safeProblem = (error: unknown, code: string, message: string) =>
    setProblem(
      error instanceof ApiProblem ? error : new ApiProblem({ code, message, retryable: true }),
    );
  const download = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const upload = async (file?: File) => {
    if (!ready || !file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setProblem(
        new ApiProblem({
          code: "ATTACHMENT_INVALID",
          message: "PNG/JPEG, 5 MiB 이하 이미지만 첨부할 수 있습니다.",
          retryable: false,
        }),
      );
      return;
    }
    try {
      setProblem(null);
      await api.post(`/projects/${projectId}/artifacts/${artifactId}/attachments`, {
        media_type: file.type,
        content_base64: await asBase64(file),
      });
    } catch (error) {
      safeProblem(error, "ATTACHMENT_FAILED", "첨부에 실패했습니다.");
    }
  };
  const exportDocx = async () => {
    if (!ready) return;
    try {
      setProblem(null);
      const result = await api.download(
        `/projects/${projectId}/artifacts/${artifactId}/exports/docx`,
        { markdown, filename: "document.docx" },
      );
      download(result.blob, result.filename);
    } catch (error) {
      safeProblem(error, "DOCX_EXPORT_FAILED", "DOCX 생성에 실패했습니다.");
    }
  };
  const exportXlsx = async () => {
    if (!ready) return;
    const model = {
      cover: {
        public_document_id: artifactId,
        title: "Generic Excel",
        description: "U5 export",
        artifact_type: "ExcelDocument",
      },
      change_history: [],
      body_blocks: [{ kind: "paragraph", content: markdown }],
      attachment_ids: [],
    };
    try {
      setProblem(null);
      const result = await api.download(
        `/projects/${projectId}/artifacts/${artifactId}/exports/xlsx`,
        { model, template_kind: "GenericExcel" },
      );
      download(result.blob, result.filename);
    } catch (error) {
      safeProblem(error, "XLSX_EXPORT_FAILED", "XLSX 생성에 실패했습니다.");
    }
  };
  return (
    <section>
      <h2>첨부 및 내보내기</h2>
      <input
        data-testid="attachment-upload-input"
        type="file"
        accept="image/png,image/jpeg"
        disabled={!ready}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <textarea
        aria-label="DOCX Markdown"
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
        disabled={!ready}
      />
      <button data-testid="docx-export-button" disabled={!ready} onClick={() => void exportDocx()}>
        DOCX 다운로드
      </button>
      <button data-testid="xlsx-export-button" disabled={!ready} onClick={() => void exportXlsx()}>
        XLSX 다운로드
      </button>
      <SafeFeedback problem={problem} />
    </section>
  );
}
