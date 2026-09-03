import { describe, expect, it } from "vitest";
import {
  GenericMarkdownDocument,
  buildDocumentExportSource,
  replaceDocumentBody,
  synchronizeDocumentTitle,
  updateDocumentCoverField,
  updateDocumentInfoValue,
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
  it("replaces only the Markdown body and preserves the complete front matter", () => {
    const next = replaceDocumentBody(source, "# 변경 본문\n\n변경 내용");

    expect(new GenericMarkdownDocument(next).frontMatter).toBe(
      new GenericMarkdownDocument(source).frontMatter,
    );
    expect(new GenericMarkdownDocument(next).body).toBe("# 변경 본문\n\n변경 내용");
    expect(next).toContain('changes: "최초 작성"');
  });

  it("updates cover fields and info values without changing body or changelog", () => {
    const withTitle = updateDocumentCoverField(source, "title", "새 제목: 검토본");
    const next = updateDocumentInfoValue(withTitle, 0, "새 발주처");
    const document = new GenericMarkdownDocument(next);

    expect(document.title).toBe("새 제목: 검토본");
    expect(document.info[0]?.value).toBe("새 발주처");
    expect(document.body).toBe("# 본문\n\n기존 내용");
    expect(document.changelog[0]?.changes).toBe("최초 작성");
  });

  it("synchronizes the managed cover title with the artifact title", () => {
    const next = synchronizeDocumentTitle(source, "MarkdownDocument", "산출물 기준 제목");
    const document = new GenericMarkdownDocument(next);

    expect(document.title).toBe("산출물 기준 제목");
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
  });
});
