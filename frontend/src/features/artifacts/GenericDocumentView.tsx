import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiClient } from "../../shared/api/client";
import { type ImageAttachmentResponse, type ProjectSummary } from "../../shared/api/models";
import {
  GenericMarkdownDocument,
  ManagedDocumentFactory,
  replaceDocumentBody,
} from "./document-model";
import { MarkdownImageControls } from "./MarkdownImageControls";

type View = "preview" | "source";

export function GenericDocumentView({
  content,
  onContentChange,
  disabled,
  activeView,
  showNavigation = true,
  documentTitle,
  projectInformation,
  api,
  projectId,
  artifactId,
}: {
  content: string;
  onContentChange: (value: string) => void;
  disabled: boolean;
  activeView?: View;
  showNavigation?: boolean;
  documentTitle: string;
  projectInformation: ProjectSummary | null;
  api?: ApiClient;
  projectId?: string;
  artifactId?: string;
}) {
  const [localView, setLocalView] = useState<View>("preview");
  const view = activeView ?? localView;
  const document = useMemo(() => {
    const resolved = ManagedDocumentFactory.create(content);
    return resolved instanceof GenericMarkdownDocument
      ? resolved
      : new GenericMarkdownDocument(content);
  }, [content]);


  const imagePaths = useMemo(
    () =>
      Array.from(document.body.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g), (match) => match[1]),
    [document.body],
  );
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<ImageAttachmentResponse[]>([]);
  const loadAttachments = useCallback(async () => {
    if (!api || !projectId || !artifactId) {
      setAttachments([]);
      return;
    }
    try {
      const items = await api.get<ImageAttachmentResponse[]>(
        `/projects/${projectId}/artifacts/${artifactId}/attachments`,
      );
      setAttachments(items);
    } catch {
      setAttachments([]);
    }
  }, [api, artifactId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- source-mode attachment state follows an external API */
  useEffect(() => {
    if (
      (view === "source" || imagePaths.length > 0) &&
      api &&
      projectId &&
      artifactId
    ) {
      void loadAttachments();
    }
  }, [api, artifactId, imagePaths.length, loadAttachments, projectId, view]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const insertImage = (markdownPath: string, description: string) => {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? document.body.length;
    const end = editor?.selectionEnd ?? start;
    const markdown = `![${description.trim()}](${markdownPath})`;
    const leadingBreak = start > 0 && document.body[start - 1] !== "\n" ? "\n" : "";
    const trailingBreak = end < document.body.length && document.body[end] !== "\n" ? "\n" : "";
    const insertion = `${leadingBreak}${markdown}${trailingBreak}`;
    const nextBody = `${document.body.slice(0, start)}${insertion}${document.body.slice(end)}`;
    onContentChange(replaceDocumentBody(content, nextBody));
    window.requestAnimationFrame(() => {
      const cursor = start + insertion.length;
      editor?.focus();
      editor?.setSelectionRange(cursor, cursor);
    });
  };
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
          attachments={attachments}
          api={api}
          projectId={projectId}
          artifactId={artifactId}
        />
      ) : null}
      {view === "source" ? (
        <div className="requirements-source-editor">
          <div className="source-editor-heading">
            <strong>Markdown 본문</strong>
            <span>{document.body.length.toLocaleString()}자</span>
          </div>
          <MarkdownImageControls
            api={api}
            projectId={projectId}
            artifactId={artifactId}
            disabled={disabled}
            attachments={attachments}
            onUploaded={loadAttachments}
            onInsert={insertImage}
          />
          <textarea
            ref={editorRef}
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
  attachments,
  api,
  projectId,
  artifactId,
}: {
  document: GenericMarkdownDocument;
  documentTitle: string;
  projectInformation: ProjectSummary | null;
  attachments: ImageAttachmentResponse[];
  api?: ApiClient;
  projectId?: string;
  artifactId?: string;
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
          {renderMarkdown(page, { attachments, api, projectId, artifactId })}
          <span className="page-number">{++pageNumber}</span>
        </article>
      ))}
    </div>
  );
}

type MarkdownImageContext = {
  attachments: ImageAttachmentResponse[];
  api?: ApiClient;
  projectId?: string;
  artifactId?: string;
};

function MarkdownImage({
  alt,
  path,
  context,
}: {
  alt: string;
  path: string;
  context: MarkdownImageContext;
}) {
  const [originalSource, setOriginalSource] = useState<string | null>(null);
  const attachment = context.attachments.find((item) => item.markdown_path === path);
  const thumbnailSource = attachment?.thumbnail_base64
    ? `data:${attachment.media_type};base64,${attachment.thumbnail_base64}`
    : null;

  useEffect(() => {
    let active = true;
    if (!attachment || !context.api || !context.projectId || !context.artifactId) {
      return () => {
        active = false;
      };
    }
    void context.api
      .get<ImageAttachmentResponse>(
        `/projects/${context.projectId}/artifacts/${context.artifactId}/attachments/${attachment.attachment_id}`,
      )
      .then((resolved) => {
        if (active && resolved.content_base64) {
          setOriginalSource(`data:${resolved.media_type};base64,${resolved.content_base64}`);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attachment, context.api, context.artifactId, context.projectId]);

  const source = originalSource ?? thumbnailSource;
  return source ? (
    <img className="markdown-attachment-image" src={source} alt={alt} />
  ) : (
    <span className="markdown-image-missing">{alt || path}</span>
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

function renderMarkdown(source: string, imageContext: MarkdownImageContext): ReactNode[] {
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
    const image = /^!\[([^\]]*)\]\((assets\/[^)]+)\)\s*$/.exec(line);
    if (image) {
      nodes.push(
        <MarkdownImage
          key={`${index}-${image[2]}`}
          alt={image[1]}
          path={image[2]}
          context={imageContext}
        />,
      );
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
      !/^(#{1,6})\s|^>|^[-*]\s+|^\d+\.\s+|^!\[[^\]]*\]\(assets\//.test(lines[index])
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
