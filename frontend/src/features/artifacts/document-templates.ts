export type TemplateCategory = "predefined" | "common";
export type TemplateArtifactType = "MarkdownDocument" | "ExcelDocument";

export type TemplateDraft = {
  templateId: string;
  title: string;
  description: string;
  artifactType: TemplateArtifactType;
  content: string;
};

export abstract class DocumentTemplate {
  abstract readonly id: string;
  abstract readonly category: TemplateCategory;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly artifactType: TemplateArtifactType;
  abstract readonly icon: "requirements" | "test" | "word" | "excel";
  abstract create(): TemplateDraft;

  protected workbookSource(
    title: string,
    templateId: "requirements-definition" | "test-scenario" | "generic-excel",
    sheetName: string,
    columns: { key: string; label: string; type?: "text" | "number" | "date" }[],
    firstRow: Record<string, string>,
  ): string {
    return JSON.stringify(
      {
        schema: "aidlc.workbook/v1",
        workbook: {
          title,
          templateId,
          sheets: [
            {
              id: "sheet1",
              name: sheetName,
              columns: columns.map((column) => ({ type: "text", ...column })),
              rows: [firstRow],
            },
          ],
        },
      },
      null,
      2,
    );
  }
}

export class RequirementsDefinitionTemplate extends DocumentTemplate {
  readonly id = "requirements-definition";
  readonly category = "predefined" as const;
  readonly name = "요구사항 정의서";
  readonly description = "요구사항, 수용기준, 테스트 연결을 구조적으로 관리합니다.";
  readonly artifactType = "ExcelDocument" as const;
  readonly icon = "requirements" as const;
  create(): TemplateDraft {
    const columns = [
      { key: "requirement_id", label: "요구사항 ID" },
      { key: "business_area", label: "업무영역" },
      { key: "business_name", label: "업무명" },
      { key: "requirement_type", label: "요구사항 유형" },
      { key: "requirement_name", label: "요구사항 명" },
      { key: "category", label: "구분" },
      { key: "approach", label: "적용방안" },
      { key: "changes", label: "변경사항" },
      { key: "source", label: "출처" },
      { key: "reflected", label: "반영여부" },
      { key: "acceptance_criteria", label: "수용기준" },
      { key: "unit_test_ids", label: "단위테스트 ID" },
      { key: "integration_test_ids", label: "통합테스트 ID" },
      { key: "verification_documents", label: "검증 문서" },
    ];
    return {
      templateId: this.id,
      title: this.name,
      description: this.description,
      artifactType: this.artifactType,
      content: this.workbookSource(this.name, this.id, "요구사항", columns, {
        requirement_id: "REQ-001",
        business_area: "",
        business_name: "",
        requirement_type: "기능",
        requirement_name: "",
        category: "신규",
        approach: "",
        changes: "",
        source: "",
        reflected: "미반영",
        acceptance_criteria: "",
        unit_test_ids: "-",
        integration_test_ids: "-",
        verification_documents: "-",
      }),
    };
  }
}

export class TestScenarioTemplate extends DocumentTemplate {
  readonly id = "test-scenario";
  readonly category = "predefined" as const;
  readonly name = "테스트 시나리오";
  readonly description = "사전조건, 수행 절차, 기대 결과와 요구사항 연결을 관리합니다.";
  readonly artifactType = "ExcelDocument" as const;
  readonly icon = "test" as const;
  create(): TemplateDraft {
    const columns = [
      { key: "test_id", label: "테스트 ID" },
      { key: "category", label: "구분" },
      { key: "scenario", label: "시나리오" },
      { key: "precondition", label: "사전조건" },
      { key: "steps", label: "수행 절차" },
      { key: "expected_result", label: "기대 결과" },
      { key: "requirement_ids", label: "요구사항 ID" },
      { key: "status", label: "상태" },
      { key: "actual_result", label: "실제 결과" },
      { key: "note", label: "비고" },
    ];
    return {
      templateId: this.id,
      title: this.name,
      description: this.description,
      artifactType: this.artifactType,
      content: this.workbookSource(this.name, this.id, "테스트 시나리오", columns, {
        test_id: "TC-001",
        category: "기능",
        scenario: "",
        precondition: "",
        steps: "",
        expected_result: "",
        requirement_ids: "REQ-001",
        status: "작성중",
        actual_result: "",
        note: "",
      }),
    };
  }
}

export class GenericWordTemplate extends DocumentTemplate {
  readonly id = "generic-word";
  readonly category = "common" as const;
  readonly name = "일반 Word 문서";
  readonly description =
    "프로젝트 정보 표지와 Markdown 제목 기반 목차를 제공하는 자유 형식 문서입니다.";
  readonly artifactType = "MarkdownDocument" as const;
  readonly icon = "word" as const;
  create(): TemplateDraft {
    return {
      templateId: this.id,
      title: "새 Word 문서",
      description: this.description,
      artifactType: this.artifactType,
      content: "## 문서 개요\n\n문서 내용을 작성하세요.",
    };
  }
}

export class GenericExcelTemplate extends DocumentTemplate {
  readonly id = "generic-excel";
  readonly category = "common" as const;
  readonly name = "일반 Excel 문서";
  readonly description = "컬럼과 행을 구조적으로 관리하는 XLSX workbook입니다.";
  readonly artifactType = "ExcelDocument" as const;
  readonly icon = "excel" as const;
  create(): TemplateDraft {
    const content = JSON.stringify(
      {
        schema: "aidlc.workbook/v1",
        workbook: {
          title: "새 Excel 문서",
          templateId: "generic-excel",
          sheets: [
            {
              id: "sheet1",
              name: "Sheet1",
              columns: [
                { key: "column1", label: "칼럼 1", type: "text" },
                { key: "column2", label: "칼럼 2", type: "text" },
              ],
              rows: [{ column1: "", column2: "" }],
            },
          ],
        },
      },
      null,
      2,
    );
    return {
      templateId: this.id,
      title: "새 Excel 문서",
      description: this.description,
      artifactType: this.artifactType,
      content,
    };
  }
}

export class DocumentTemplateRegistry {
  private static readonly templates: DocumentTemplate[] = [
    new RequirementsDefinitionTemplate(),
    new TestScenarioTemplate(),
    new GenericWordTemplate(),
    new GenericExcelTemplate(),
  ];

  static all(): readonly DocumentTemplate[] {
    return this.templates;
  }

  static byCategory(category: TemplateCategory): readonly DocumentTemplate[] {
    return this.templates.filter((template) => template.category === category);
  }

  static create(templateId: string): TemplateDraft {
    const template = this.templates.find((item) => item.id === templateId);
    if (!template) throw new Error(`Unknown document template: ${templateId}`);
    return template.create();
  }

  static register(template: DocumentTemplate): void {
    if (this.templates.some((item) => item.id === template.id)) {
      throw new Error(`Duplicate document template: ${template.id}`);
    }
    this.templates.push(template);
  }
}
