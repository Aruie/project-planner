import { describe, expect, it } from "vitest";
import {
  GenericMarkdownDocument,
  replaceDocumentBody,
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
});
