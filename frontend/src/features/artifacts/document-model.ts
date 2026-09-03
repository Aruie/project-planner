export type DocumentKind =
  "generic-markdown" | "requirements-definition" | "structured-spreadsheet";

export type SpreadsheetColumn = { key: string; label: string; type: "text" | "number" | "date" };
export type SpreadsheetSheet = {
  id: string;
  name: string;
  columns: SpreadsheetColumn[];
  rows: Record<string, string>[];
};
export type SpreadsheetWorkbook = { title: string; sheets: SpreadsheetSheet[] };

export type CoverInfo = { label: string; value: string };
export type ChangeLogEntry = {
  version: string;
  date: string;
  changes: string;
  author: string;
};
export type DocumentCover = {
  title: string;
  subtitle: string;
  company: string;
  info: CoverInfo[];
};
export type DocumentToc = { title: string; items: string[] };

export type RequirementRecord = {
  id: string;
  area: string;
  businessName: string;
  type: string;
  name: string;
  category: string;
  approach: string;
  changes: string;
  source: string;
  reflected: string;
  acceptanceCriteria: string;
  unitTestIds: string;
  integrationTestIds: string;
  verificationDocuments: string;
};

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const splitDocument = (source: string): { frontMatter: string; body: string } => {
  const normalized = source.trimStart();
  const match = /^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)([\s\S]*)$/.exec(normalized);
  return match ? { frontMatter: match[1], body: match[2] } : { frontMatter: "", body: source };
};

export type EditableCoverField = "title" | "subtitle" | "company";

const joinDocument = (frontMatter: string, body: string): string =>
  frontMatter ? `---\n${frontMatter}\n---\n${body}` : body;

export const replaceDocumentBody = (source: string, body: string): string => {
  const parts = splitDocument(source);
  return joinDocument(parts.frontMatter, body);
};

const yamlScalar = (value: string): string => JSON.stringify(value);

export const updateDocumentCoverField = (
  source: string,
  field: EditableCoverField,
  value: string,
): string => {
  const parts = splitDocument(source);
  const lines = parts.frontMatter ? parts.frontMatter.split("\n") : [];
  let coverIndex = lines.findIndex((line) => /^cover:\s*$/.test(line));
  if (coverIndex < 0) {
    lines.unshift("cover:");
    coverIndex = 0;
  }
  let end = lines.length;
  for (let index = coverIndex + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index])) {
      end = index;
      break;
    }
  }
  const fieldPattern = new RegExp(`^  ${field}:\\s*`);
  const fieldIndex = lines.findIndex(
    (line, index) => index > coverIndex && index < end && fieldPattern.test(line),
  );
  const nextLine = `  ${field}: ${yamlScalar(value)}`;
  if (fieldIndex >= 0) lines[fieldIndex] = nextLine;
  else lines.splice(coverIndex + 1, 0, nextLine);
  return joinDocument(lines.join("\n"), parts.body);
};

export const updateDocumentInfoValue = (
  source: string,
  infoIndex: number,
  value: string,
): string => {
  const parts = splitDocument(source);
  if (!parts.frontMatter) return source;
  const lines = parts.frontMatter.split("\n");
  let inCover = false;
  let inInfo = false;
  let currentInfo = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^cover:\s*$/.test(line)) {
      inCover = true;
      continue;
    }
    if (inCover && /^\S/.test(line)) break;
    if (inCover && /^ {2}info:\s*$/.test(line)) {
      inInfo = true;
      continue;
    }
    if (!inInfo) continue;
    if (/^ {4}- label:\s*/.test(line)) {
      currentInfo += 1;
      continue;
    }
    if (currentInfo === infoIndex && /^ {6}value:\s*/.test(line)) {
      lines[index] = `      value: ${yamlScalar(value)}`;
      return joinDocument(lines.join("\n"), parts.body);
    }
  }
  return source;
};

const section = (frontMatter: string, name: string, nextNames: string[]): string => {
  const start = frontMatter.search(new RegExp(`^${name}:\\s*$`, "m"));
  if (start < 0) return "";
  const rest = frontMatter.slice(start + frontMatter.slice(start).indexOf("\n") + 1);
  const nextPattern = nextNames.length
    ? new RegExp(`^(?:${nextNames.join("|")}):\\s*$`, "m")
    : null;
  const end = nextPattern ? rest.search(nextPattern) : -1;
  return end < 0 ? rest : rest.slice(0, end);
};

const scalar = (block: string, key: string, indent = 2): string => {
  const match = new RegExp(`^\\s{${indent}}${key}:\\s*(.*)$`, "m").exec(block);
  return match ? unquote(match[1]) : "";
};

const parseInfo = (coverBlock: string): CoverInfo[] => {
  const result: CoverInfo[] = [];
  const pattern = /^\s*- label:\s*(.+)\n\s+value:\s*(.+)$/gm;
  for (const match of coverBlock.matchAll(pattern)) {
    result.push({ label: unquote(match[1]), value: unquote(match[2]) });
  }
  return result;
};

const parseChangeLog = (frontMatter: string): ChangeLogEntry[] => {
  const rows = frontMatter.split("\n");
  const result: ChangeLogEntry[] = [];
  let current: ChangeLogEntry | null = null;
  let inRows = false;
  for (const line of rows) {
    if (/^\s{2}rows:\s*$/.test(line)) {
      inRows = true;
      continue;
    }
    if (inRows && /^\S/.test(line)) break;
    const version = /^\s{4}- version:\s*(.+)$/.exec(line);
    if (version) {
      if (current) result.push(current);
      current = { version: unquote(version[1]), date: "", changes: "", author: "" };
      continue;
    }
    if (!current) continue;
    const field = /^\s{6}(date|changes|author):\s*(.*)$/.exec(line);
    if (!field) continue;
    const value = unquote(field[2]);
    if (field[1] === "date") current.date = value;
    if (field[1] === "changes") current.changes = value;
    if (field[1] === "author") current.author = value;
  }
  if (current) result.push(current);
  return result;
};

const parseToc = (frontMatter: string): DocumentToc => {
  const block = section(frontMatter, "toc", []);
  const items: string[] = [];
  let inItems = false;
  for (const line of block.split("\n")) {
    if (/^\s{2}items:\s*$/.test(line)) {
      inItems = true;
      continue;
    }
    if (inItems) {
      const item = /^\s{4}-\s*(.+)$/.exec(line);
      if (item) items.push(unquote(item[1]));
    }
  }
  return { title: scalar(block, "title"), items };
};

const tableCells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((value) => value.trim());

const parseRequirementRows = (source: string): RequirementRecord[] => {
  const lines = source.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\|\s*요구사항 ID\s*\|/.test(line));
  if (headerIndex < 0) return [];
  const headers = tableCells(lines[headerIndex]);
  const fieldByHeader: Record<string, keyof RequirementRecord> = {
    "요구사항 ID": "id",
    업무영역: "area",
    업무명: "businessName",
    "요구사항 유형": "type",
    "요구사항 명": "name",
    구분: "category",
    적용방안: "approach",
    변경사항: "changes",
    출처: "source",
    반영여부: "reflected",
    수용기준: "acceptanceCriteria",
    "단위테스트 ID": "unitTestIds",
    "통합테스트 ID": "integrationTestIds",
    "검증 문서": "verificationDocuments",
  };
  const result: RequirementRecord[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) break;
    const values = tableCells(line);
    const record: RequirementRecord = {
      id: "",
      area: "",
      businessName: "",
      type: "",
      name: "",
      category: "",
      approach: "",
      changes: "",
      source: "",
      reflected: "",
      acceptanceCriteria: "",
      unitTestIds: "",
      integrationTestIds: "",
      verificationDocuments: "",
    };
    headers.forEach((header, index) => {
      const field = fieldByHeader[header];
      if (field) record[field] = values[index] ?? "";
    });
    if (record.id) result.push(record);
  }
  return result;
};

export abstract class ManagedDocument {
  readonly source: string;
  readonly frontMatter: string;
  readonly body: string;
  readonly cover: DocumentCover;
  readonly changelog: ChangeLogEntry[];
  readonly toc: DocumentToc;

  protected constructor(source: string) {
    this.source = source;
    const parts = splitDocument(source);
    this.frontMatter = parts.frontMatter;
    this.body = parts.body;
    const coverBlock = section(parts.frontMatter, "cover", ["changelog", "toc"]);
    this.cover = {
      title: scalar(coverBlock, "title"),
      subtitle: scalar(coverBlock, "subtitle"),
      company: scalar(coverBlock, "company"),
      info: parseInfo(coverBlock),
    };
    this.changelog = parseChangeLog(parts.frontMatter);
    this.toc = parseToc(parts.frontMatter);
  }

  abstract get kind(): DocumentKind;
  get title(): string {
    return this.cover.title;
  }
  get subtitle(): string {
    return this.cover.subtitle;
  }
  get company(): string {
    return this.cover.company;
  }
  get info(): CoverInfo[] {
    return this.cover.info;
  }
  get hasFrontMatter(): boolean {
    return Boolean(this.frontMatter);
  }
}

export class GenericMarkdownDocument extends ManagedDocument {
  get kind(): DocumentKind {
    return "generic-markdown";
  }

  constructor(source: string) {
    super(source);
  }
}

export class RequirementsDefinitionDocument extends GenericMarkdownDocument {
  readonly requirements: RequirementRecord[];

  get kind(): DocumentKind {
    return "requirements-definition";
  }

  constructor(source: string) {
    super(source);
    this.requirements = parseRequirementRows(source);
  }

  static supports(source: string): boolean {
    return /^\|\s*요구사항 ID\s*\|/m.test(source);
  }
}

export class SpreadsheetDocument extends ManagedDocument {
  readonly workbook: SpreadsheetWorkbook;

  get kind(): DocumentKind {
    return "structured-spreadsheet";
  }

  constructor(source: string) {
    super(source);
    this.workbook = SpreadsheetDocument.parse(source);
  }

  static supports(source: string): boolean {
    try {
      const value = JSON.parse(source) as { schema?: unknown; workbook?: unknown };
      return value.schema === "aidlc.workbook/v1" && Boolean(value.workbook);
    } catch {
      return false;
    }
  }

  static stringify(workbook: SpreadsheetWorkbook): string {
    return JSON.stringify({ schema: "aidlc.workbook/v1", workbook }, null, 2);
  }

  private static parse(source: string): SpreadsheetWorkbook {
    try {
      const value = JSON.parse(source) as { workbook?: SpreadsheetWorkbook };
      if (value.workbook?.sheets?.length) return value.workbook;
    } catch {
      const migrated = this.fromMarkdownTable(source);
      if (migrated) return migrated;
    }
    return {
      title: "새 Excel 문서",
      sheets: [{ id: "sheet1", name: "Sheet1", columns: [], rows: [] }],
    };
  }

  private static fromMarkdownTable(source: string): SpreadsheetWorkbook | null {
    const lines = source.split(/\r?\n/);
    const headerIndex = lines.findIndex(
      (line, index) => line.trim().startsWith("|") && /^\s*\|?\s*:?-+/.test(lines[index + 1] ?? ""),
    );
    if (headerIndex < 0) return null;
    const cells = (line: string) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
    const labels = cells(lines[headerIndex]);
    const columns: SpreadsheetColumn[] = labels.map((label, index) => ({
      key: `column${index + 1}`,
      label: label || `칼럼 ${index + 1}`,
      type: "text",
    }));
    const rows: Record<string, string>[] = [];
    for (const line of lines.slice(headerIndex + 2)) {
      if (!line.trim().startsWith("|")) break;
      const values = cells(line);
      rows.push(
        Object.fromEntries(columns.map((column, index) => [column.key, values[index] ?? ""])),
      );
    }
    return {
      title: "가져온 Excel 문서",
      sheets: [{ id: "sheet1", name: "Sheet1", columns, rows }],
    };
  }
}

export class ManagedDocumentFactory {
  static create(
    source: string,
    artifactType?: "MarkdownDocument" | "ExcelDocument",
  ): ManagedDocument {
    if (artifactType === "ExcelDocument" || SpreadsheetDocument.supports(source)) {
      return new SpreadsheetDocument(source);
    }
    if (RequirementsDefinitionDocument.supports(source)) {
      return new RequirementsDefinitionDocument(source);
    }
    return new GenericMarkdownDocument(source);
  }
}
