import { DocumentTemplateRegistry, type TemplateDraft } from "./document-templates";

const categories = [
  {
    id: "predefined" as const,
    title: "사전정의 템플릿",
    description: "업무 규칙과 전용 관리 화면이 포함된 문서",
  },
  {
    id: "common" as const,
    title: "공용 템플릿",
    description: "자유롭게 구성하는 기본 Word·Excel 문서",
  },
];

export function TemplateSelectionModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (draft: TemplateDraft) => void;
}) {
  if (!open) return null;
  return (
    <div className="template-modal-backdrop" onMouseDown={onClose}>
      <section
        className="template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>NEW ARTIFACT</p>
            <h2 id="template-modal-title">산출물 템플릿 선택</h2>
            <span>문서 종류에 맞는 작성 화면과 기본 구조가 준비됩니다.</span>
          </div>
          <button onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="template-modal-body">
          {categories.map((category) => (
            <section className="template-category" key={category.id}>
              <div className="template-category-heading">
                <div>
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                </div>
                <span>{DocumentTemplateRegistry.byCategory(category.id).length}</span>
              </div>
              <div className="template-grid">
                {DocumentTemplateRegistry.byCategory(category.id).map((template) => (
                  <button key={template.id} onClick={() => onSelect(template.create())}>
                    <span className={`template-icon ${template.icon}`} aria-hidden="true">
                      {template.icon === "requirements"
                        ? "RQ"
                        : template.icon === "test"
                          ? "TC"
                          : template.icon === "word"
                            ? "W"
                            : "X"}
                    </span>
                    <span className="template-copy">
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                      <em>{template.artifactType === "ExcelDocument" ? "XLSX" : "DOCX"}</em>
                    </span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
