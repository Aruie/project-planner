import { useRef, useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type ImageAttachmentResponse } from "../../shared/api/models";
import { SafeFeedback } from "../../shared/ui/SafeFeedback";
import { createImageThumbnail, imageFileAsBase64 } from "./image-attachments";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Props = {
  api?: ApiClient;
  projectId?: string;
  artifactId?: string;
  disabled: boolean;
  attachments: ImageAttachmentResponse[];
  onUploaded: () => Promise<void>;
  onInsert: (markdownPath: string, description: string) => void;
};

export function MarkdownImageControls({
  api,
  projectId,
  artifactId,
  disabled,
  attachments,
  onUploaded,
  onInsert,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const ready = Boolean(api && projectId && artifactId && !disabled && !uploading);

  const upload = async (file?: File) => {
    if (!file || !api || !projectId || !artifactId || !ready) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setProblem(
        new ApiProblem({
          code: "ATTACHMENT_INVALID",
          message: "PNG/JPEG, 5 MiB 이하 이미지만 업로드할 수 있습니다.",
          retryable: false,
        }),
      );
      return;
    }
    setUploading(true);
    setProblem(null);
    try {
      const [contentBase64, thumbnail] = await Promise.all([
        imageFileAsBase64(file),
        createImageThumbnail(file),
      ]);
      const saved = await api.post<ImageAttachmentResponse>(
        `/projects/${projectId}/artifacts/${artifactId}/attachments`,
        {
          media_type: file.type,
          filename: file.name,
          content_base64: contentBase64,
          thumbnail_media_type: thumbnail.mediaType,
          thumbnail_base64: thumbnail.contentBase64,
        },
      );
      await onUploaded();
      onInsert(saved.markdown_path, description);
    } catch (error) {
      setProblem(
        error instanceof ApiProblem
          ? error
          : new ApiProblem({
              code: "ATTACHMENT_FAILED",
              message: "이미지 업로드에 실패했습니다.",
              retryable: true,
            }),
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="markdown-image-controls" aria-label="이미지 첨부">
      <div className="markdown-image-toolbar">
        <label>
          <span>이미지 설명</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="예: 미들웨어 테스트 결과"
            disabled={!ready}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={!ready}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? "업로드 중…" : "이미지 업로드"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>
      {!artifactId ? <p>문서를 먼저 생성하면 이미지를 업로드할 수 있습니다.</p> : null}
      {attachments.length ? (
        <div className="markdown-image-gallery" aria-label="업로드된 이미지">
          {attachments.map((attachment) => (
            <button
              key={attachment.attachment_id}
              type="button"
              className="markdown-image-thumbnail"
              title={`${attachment.filename}을 현재 커서 위치에 삽입`}
              disabled={!ready}
              onClick={() => onInsert(attachment.markdown_path, description)}
            >
              {attachment.thumbnail_base64 ? (
                <img
                  src={`data:${attachment.media_type};base64,${attachment.thumbnail_base64}`}
                  alt=""
                />
              ) : (
                <span>IMAGE</span>
              )}
              <small>{attachment.filename || attachment.markdown_path}</small>
            </button>
          ))}
        </div>
      ) : (
        <p>업로드한 이미지의 썸네일을 누르면 현재 커서 위치에 Markdown이 삽입됩니다.</p>
      )}
      <SafeFeedback problem={problem} />
    </section>
  );
}
