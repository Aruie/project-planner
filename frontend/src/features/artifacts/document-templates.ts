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

  protected wordSource(title: string, tocItems: string[], body: string): string {
    return `---
cover:
  title: ${title}
  subtitle: ""
  company: ""
  info:
    - label: 문 서 버 전
      value: v0.1

changelog:
  title: 개정 이력
  columns:
    - 버전
    - 개정일
    - 주요 변경 내용
    - 작성자
  rows: []

toc:
  title: 목차
  items:
${tocItems.map((item) => `    - ${item}`).join("\n")}
---

${body}`;
  }
}

export class RequirementsDefinitionTemplate extends DocumentTemplate {
  readonly id = "requirements-definition";
  readonly category = "predefined" as const;
  readonly name = "요구사항 정의서";
  readonly description = "요구사항, 수용기준, 테스트 연결을 구조적으로 관리합니다.";
  readonly artifactType = "MarkdownDocument" as const;
  readonly icon = "requirements" as const;
  create(): TemplateDraft {
    return {
      templateId: this.id,
      title: this.name,
      description: this.description,
      artifactType: this.artifactType,
      content: this.wordSource(
        this.name,
        ["요구사항 리스트"],
        `## 요구사항 리스트

| 요구사항 ID | 업무영역 | 업무명 | 요구사항 유형 | 요구사항 명 | 구분 | 적용방안 | 변경사항 | 출처 | 반영여부 | 수용기준 | 단위테스트 ID | 통합테스트 ID | 검증 문서 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 |  |  | 기능 |  | 신규 |  |  |  | 미반영 |  | - | - | - |`,
      ),
    };
  }
}

export class TestScenarioTemplate extends DocumentTemplate {
  readonly id = "test-scenario";
  readonly category = "predefined" as const;
  readonly name = "테스트 시나리오";
  readonly description = "사전조건, 수행 절차, 기대 결과와 요구사항 연결을 관리합니다.";
  readonly artifactType = "MarkdownDocument" as const;
  readonly icon = "test" as const;
  create(): TemplateDraft {
    return {
      templateId: this.id,
      title: this.name,
      description: this.description,
      artifactType: this.artifactType,
      content: this.wordSource(
        this.name,
        ["테스트 개요", "테스트 시나리오"],
        `## 테스트 개요

테스트 범위와 목적을 작성하세요.

## 테스트 시나리오

| 테스트 ID | 구분 | 시나리오 | 사전조건 | 수행 절차 | 기대 결과 | 요구사항 ID | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-001 | 기능 |  |  |  |  | REQ-001 | 작성중 |`,
      ),
    };
  }
}

export class GenericWordTemplate extends DocumentTemplate {
  readonly id = "generic-word";
  readonly category = "common" as const;
  readonly name = "일반 Word 문서";
  readonly description = "표지, 개정이력, 목차가 포함된 자유 형식 DOCX 문서입니다.";
  readonly artifactType = "MarkdownDocument" as const;
  readonly icon = "word" as const;
  create(): TemplateDraft {
    return {
      templateId: this.id,
      title: "새 Word 문서",
      description: this.description,
      artifactType: this.artifactType,
      content: this.wordSource("새 Word 문서", ["본문"], "## 본문\n\n문서 내용을 작성하세요."),
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
