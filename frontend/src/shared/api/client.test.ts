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
});
