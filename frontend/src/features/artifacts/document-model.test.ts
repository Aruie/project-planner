import { describe, expect, it } from "vitest";
import {
  GenericMarkdownDocument,
  buildDocumentExportSource,
  replaceDocumentBody,
  stripDocumentMetadata,
  synchronizeDocumentTitle,
} from "./document-model";

const source = `---
cover:
  title: 기존 제목
  subtitle: 기존 부제
  company: 기존 기관
  info:
    - label: 발 주 처
      value: 기존 발주처
changelog:
  rows:
    - version: "1"
      date: "2026.09.03"
      changes: "최초 작성"
      author: 작성자
---
# 본문

기존 내용`;

describe("managed document protected metadata", () => {
  it("stores only the editable Markdown body when legacy front matter exists", () => {
    const next = replaceDocumentBody(source, "# 변경 제목\n\n## 변경 내용\n\n설명");

    expect(next).toBe("# 변경 제목\n\n## 변경 내용\n\n설명");
    expect(new GenericMarkdownDocument(next).frontMatter).toBe("");
    expect(stripDocumentMetadata(source)).toBe("# 본문\n\n기존 내용");
  });

  it("builds the table of contents from level one and two Markdown headings", () => {
    const document = new GenericMarkdownDocument(
      "# 변경관리내역서\n\n## 변경 요약\n\n### 세부 항목\n\n## 승인 절차",
    );

    expect(document.toc).toEqual({
      title: "목차",
      items: ["변경관리내역서", "변경 요약", "승인 절차"],
    });
  });

  it("keeps the artifact title out of the stored Markdown source", () => {
    const next = synchronizeDocumentTitle(source, "MarkdownDocument", "산출물 기준 제목");
    const document = new GenericMarkdownDocument(next);

    expect(document.frontMatter).toBe("");
    expect(document.title).toBe("");
    expect(document.body).toBe("# 본문\n\n기존 내용");
  });

  it("builds an export-only cover from project information", () => {
    const exported = buildDocumentExportSource(source, "산출물 제목", {
      taskName: "차세대 시스템 구축",
      contractorName: "수탁기관 A",
      clientName: "발주처 B",
      organizationName: "회사 C",
    });
    const document = new GenericMarkdownDocument(exported);

    expect(document.title).toBe("산출물 제목");
    expect(document.company).toBe("회사 C");
    expect(document.info).toEqual([
      { label: "과제명", value: "차세대 시스템 구축" },
      { label: "수탁기관", value: "수탁기관 A" },
      { label: "발주처", value: "발주처 B" },
    ]);
    expect(document.body).toBe("# 본문\n\n기존 내용");
    expect(document.toc.items).toEqual(["본문"]);
    expect(exported).not.toContain("changelog:");
  });
});
