export type ApiProblemPayload = {
  code: string;
  message: string;
  retryable: boolean;
  current_revision?: number;
};

export class ApiProblem extends Error {
  readonly retryable: boolean;
  readonly currentRevision?: number;

  constructor(payload: ApiProblemPayload) {
    super(payload.message);
    this.name = "ApiProblem";
    this.code = payload.code;
    this.retryable = payload.retryable;
    this.currentRevision = payload.current_revision;
  }

  readonly code: string;
}

export type ArtifactResponse = {
  artifact_id: string;
  project_id: string;
  public_document_id: string;
  artifact_type: "MarkdownDocument" | "ExcelDocument";
  draft_id: string;
  revision: number;
  title: string;
  description: string;
  tags: string[];
};

export type ArtifactDetailResponse = ArtifactResponse & { content: string };

export type VersionResponse = {
  version_id: string;
  version_number: number;
  source_draft_revision: number;
  created_at: string;
  title: string;
  description: string;
  tags: string[];
  change_summary: string;
};
export type DiffSource = { kind: "draft" | "version"; version_id?: string };
export type MetadataChange = { field: string; before: unknown; after: unknown };
export type LineHunk = {
  kind: "added" | "removed" | "unchanged";
  before: string[];
  after: string[];
};
export type DiffResult = {
  left: DiffSource;
  right: DiffSource;
  metadata_changes: MetadataChange[];
  body_hunks: LineHunk[];
  summary: { added: number; removed: number; unchanged: number };
};

export type AiMessage = { role: string; content: string; created_at: string };
export type AiWorkspaceState = {
  session_id: string;
  project_id: string;
  messages: AiMessage[];
  preview: string | null;
  expires_at: string;
};
export type TraceGapResult = {
  story_ids: string[];
  requirement_ids: string[];
  test_case_ids: string[];
};

export const isApiProblem = (value: unknown): value is ApiProblemPayload => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.code === "string" &&
    typeof data.message === "string" &&
    typeof data.retryable === "boolean"
  );
};

export type AuthMeResponse = { username: string };
export type ProjectSummary = {
  project_id: string;
  name: string;
  document_id_prefix: string;
  task_name: string;
  contractor_name: string;
  client_name: string;
  organization_name: string;
};
