export type ActiveDocumentContext = {
  documentKey: string;
  title: string;
  artifactType: "MarkdownDocument" | "ExcelDocument";
  content: string;
  persisted: boolean;
};

export type AiDocumentUpdate = {
  documentKey: string;
  content: string;
  requestId: number;
};
