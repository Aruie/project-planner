import { describe, expect, it } from "vitest";
import { DocumentTemplateRegistry } from "./document-templates";

type WorkbookSource = {
  schema: string;
  workbook: {
    templateId: string;
    sheets: { columns: { key: string; label: string }[] }[];
  };
};

const workbookOf = (templateId: string): WorkbookSource => {
  const draft = DocumentTemplateRegistry.create(templateId);
  expect(draft.artifactType).toBe("ExcelDocument");
  return JSON.parse(draft.content) as WorkbookSource;
};

describe("predefined Excel document templates", () => {
  it("creates a requirements workbook with 14 business columns", () => {
    const source = workbookOf("requirements-definition");
    expect(source.schema).toBe("aidlc.workbook/v1");
    expect(source.workbook.templateId).toBe("requirements-definition");
    expect(source.workbook.sheets[0].columns).toHaveLength(14);
    expect(source.workbook.sheets[0].columns.map((column) => column.label)).toEqual(
      expect.arrayContaining(["요구사항 ID", "수용기준", "단위테스트 ID", "통합테스트 ID"]),
    );
  });

  it("creates a test scenario workbook with 10 execution and result columns", () => {
    const source = workbookOf("test-scenario");
    expect(source.schema).toBe("aidlc.workbook/v1");
    expect(source.workbook.templateId).toBe("test-scenario");
    expect(source.workbook.sheets[0].columns).toHaveLength(10);
    expect(source.workbook.sheets[0].columns.map((column) => column.label)).toEqual(
      expect.arrayContaining(["수행 절차", "기대 결과", "요구사항 ID", "실제 결과"]),
    );
  });
});

describe("generic Word document template", () => {
  it("stores only Markdown body content and derives a meaningful TOC heading", () => {
    const draft = DocumentTemplateRegistry.create("generic-word");

    expect(draft.content).toBe("## 문서 개요\n\n문서 내용을 작성하세요.");
    expect(draft.content).not.toContain("---");
    expect(draft.content).not.toContain("## 본문");
  });
});
