import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

describe("ApiClient", () => {
  it("maps only safe error fields and includes runtime-only authorization", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "AI_SESSION_EXPIRED",
          message: "만료",
          retryable: false,
          raw: "hidden",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = new ApiClient(
      "/api",
      () => ({ username: "admin", password: "secret" }),
      fetcher,
    );
    await expect(client.get("/projects/x")).rejects.toMatchObject({
      code: "AI_SESSION_EXPIRED",
      message: "만료",
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/x",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Basic YWRtaW46c2VjcmV0" }),
      }),
    );
  });

  it("explains when the running backend does not support a newly added API", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new ApiClient("/api", () => undefined, fetcher);

    await expect(client.delete("/projects/p/artifacts/a", {})).rejects.toMatchObject({
      code: "API_METHOD_NOT_AVAILABLE",
      message: "현재 실행 중인 백엔드가 이 기능을 지원하지 않습니다. 백엔드를 재시작해주세요.",
    });
  });

  it("sends a JSON delete confirmation and accepts an empty 204 response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient("/api", () => undefined, fetcher);

    await expect(
      client.delete("/projects/p/artifacts/a", { confirmation_title: "문서" }),
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/p/artifacts/a",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirmation_title: "문서" }),
      }),
    );
  });

  it("prefers and decodes an RFC 5987 download filename", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("file", {
        status: 200,
        headers: {
          "Content-Disposition":
            "attachment; filename=\"document.docx\"; filename*=UTF-8''%EB%B3%80%EA%B2%BD%EA%B4%80%EB%A6%AC%EB%82%B4%EC%97%AD%EC%84%9C.docx",
        },
      }),
    );
    const client = new ApiClient("/api", () => undefined, fetcher);

    await expect(client.download("/exports/docx", {})).resolves.toMatchObject({
      filename: "변경관리내역서.docx",
    });
  });
});
