export function FileGenerationModal({
  open,
  filename,
  generating,
  onFilenameChange,
  onClose,
  onGenerate,
}: {
  open: boolean;
  filename: string;
  generating: boolean;
  onFilenameChange: (value: string) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  if (!open) return null;
  const normalized = filename.trim().replace(/\.pdf$/i, "");

  return (
    <div className="file-generation-backdrop" role="presentation">
      <form
        className="file-generation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-generation-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (normalized) onGenerate();
        }}
      >
        <header>
          <div>
            <span>PDF 내보내기</span>
            <h2 id="file-generation-title">파일 이름을 확인하세요</h2>
            <p>현재 미리보기의 표지, 목차와 본문을 PDF로 생성합니다.</p>
          </div>
          <button type="button" aria-label="닫기" disabled={generating} onClick={onClose}>
            ×
          </button>
        </header>
        <label>
          <span>파일명</span>
          <div className="pdf-filename-field">
            <input
              autoFocus
              data-testid="pdf-filename-input"
              value={filename}
              onChange={(event) => onFilenameChange(event.target.value.replace(/\.pdf$/i, ""))}
              placeholder="문서명_v1"
              disabled={generating}
            />
            <strong>.pdf</strong>
          </div>
          <small>확장자는 자동으로 붙습니다. 파일명만 입력하세요.</small>
        </label>
        <footer>
          <button type="button" className="secondary" disabled={generating} onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary-button" disabled={!normalized || generating}>
            {generating ? "PDF 생성 중…" : "PDF 생성"}
          </button>
        </footer>
      </form>
    </div>
  );
}
