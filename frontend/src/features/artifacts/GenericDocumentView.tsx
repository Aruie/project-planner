import { Fragment, useMemo, useState, type ReactNode } from "react";
import { type ProjectSummary } from "../../shared/api/models";
import {
  GenericMarkdownDocument,
  ManagedDocumentFactory,
  replaceDocumentBody,
} from "./document-model";

type View = "preview" | "source";

export function GenericDocumentView({
  content,
  onContentChange,
  disabled,
  activeView,
  showNavigation = true,
  documentTitle,
  projectInformation,
}: {
  content: string;
  onContentChange: (value: string) => void;
  disabled: boolean;
  activeView?: View;
  showNavigation?: boolean;
  documentTitle: string;
  projectInformation: ProjectSummary | null;
}) {
  const [localView, setLocalView] = useState<View>("preview");
  const view = activeView ?? localView;
  const document = useMemo(() => {
    const resolved = ManagedDocumentFactory.create(content);
    return resolved instanceof GenericMarkdownDocument
      ? resolved
      : new GenericMarkdownDocument(content);
  }, [content]);

  return (
    <div className="generic-document">
      {showNavigation ? (
        <nav className="document-view-tabs" aria-label="일반 문서 보기">
          <button
            className={view === "preview" ? "active" : ""}
            onClick={() => setLocalView("preview")}
          >
            미리보기
          </button>
          <button
            className={view === "source" ? "active" : ""}
            onClick={() => setLocalView("source")}
          >
            원문 편집
          </button>
        </nav>
      ) : null}

      {view === "preview" ? (
        <DocumentPreview
          document={document}
          documentTitle={documentTitle}
          projectInformation={projectInformation}
        />
      ) : null}
      {view === "source" ? (
        <div className="requirements-source-editor">
          <div className="source-editor-heading">
            <div>
              <strong>Markdown 본문</strong>
              <span>Front matter는 호환용으로 유지되며 직접 편집할 수 없습니다.</span>
            </div>
            <span>{document.body.length.toLocaleString()}자</span>
          </div>
          <div className="frontmatter-lock-notice" role="note">
            <strong>문서 메타데이터 보호됨</strong>
            <span>표지 제목은 산출물 제목을 따르며 기관 정보는 프로젝트에서 관리합니다.</span>
          </div>
          <textarea
            data-testid="artifact-content-input"
            aria-label="Markdown 본문"
            value={document.body}
            onChange={(event) => onContentChange(replaceDocumentBody(content, event.target.value))}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}

const paginateMarkdown = (body: string): string[] => {
  const pages: string[] = [];
  let current: string[] = [];
  let size = 0;
  const flush = () => {
    if (current.some((line) => line.trim())) pages.push(current.join("\n"));
    current = [];
    size = 0;
  };
  for (const line of body.split(/\r?\n/)) {
    if (/^##\s+/.test(line) && current.some((value) => value.trim())) flush();
    if (size + line.length > 3800 && current.some((value) => value.trim())) flush();
    current.push(line);
    size += line.length + 1;
  }
  flush();
  return pages.length ? pages : [body];
};

function DocumentPreview({
  document,
  documentTitle,
  projectInformation,
}: {
  document: GenericMarkdownDocument;
  documentTitle: string;
  projectInformation: ProjectSummary | null;
}) {
  const bodyPages = paginateMarkdown(document.body);
  const projectFields = [
    { label: "과제명", value: projectInformation?.task_name || projectInformation?.name || "-" },
    { label: "수탁기관", value: projectInformation?.contractor_name || "-" },
    { label: "발주처", value: projectInformation?.client_name || "-" },
  ];
  let pageNumber = 0;
  return (
    <div className="document-preview">
      {document.hasFrontMatter ? (
        <section className="preview-cover a4-page">
          <div className="preview-cover-brand">DOCUMENT</div>
          <div className="preview-cover-title">
            <h1>{documentTitle || "제목 없는 문서"}</h1>
          </div>
          <div className="preview-cover-info">
            {projectFields.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <footer>{projectInformation?.organization_name || "회사·기관 미입력"}</footer>
        </section>
      ) : null}

      {document.toc.items.length ? (
        <section className="preview-toc a4-page">
          <header>
            <span>CONTENTS</span>
            <h2>{document.toc.title || "목차"}</h2>
          </header>
          <ol>
            {document.toc.items.map((item, index) => (
              <li key={`${item}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
              </li>
            ))}
          </ol>
          <span className="page-number">{++pageNumber}</span>
        </section>
      ) : null}

      {bodyPages.map((page) => (
        <article className="markdown-preview a4-page" key={pageNumber}>
          {renderMarkdown(page)}
          <span className="page-number">{++pageNumber}</span>
        </article>
      ))}
    </div>
  );
}

function inlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((token, index) => {
    if (/^`[^`]+`$/.test(token)) return <code key={index}>{token.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(token)) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(token)) return <em key={index}>{token.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (link)
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    return <Fragment key={index}>{token}</Fragment>;
  });
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdown(source: string): ReactNode[] {
  const lines = source.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2]);
      if (level === 1) nodes.push(<h1 key={index}>{content}</h1>);
      else if (level === 2) nodes.push(<h2 key={index}>{content}</h2>);
      else if (level === 3) nodes.push(<h3 key={index}>{content}</h3>);
      else nodes.push(<h4 key={index}>{content}</h4>);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push(
        <blockquote key={index}>
          {quote.map((value, i) => (
            <p key={i}>{inlineMarkdown(value)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ul key={index}>
          {items.map((item, i) => (
            <li key={i}>{inlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      nodes.push(
        <ol key={index}>
          {items.map((item, i) => (
            <li key={i}>{inlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1])) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      nodes.push(
        <div className="markdown-table-wrap" key={index}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, i) => (
                  <th key={i}>{inlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{inlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={index} />);
      index += 1;
      continue;
    }
    const paragraph: string[] = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s|^>|^[-*]\s+|^\d+\.\s+/.test(lines[index])
    ) {
      if (
        lines[index].includes("|") &&
        index + 1 < lines.length &&
        /^\s*\|?\s*:?-+/.test(lines[index + 1])
      )
        break;
      paragraph.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p key={index}>{inlineMarkdown(paragraph.join(" "))}</p>);
  }
  return nodes;
}
