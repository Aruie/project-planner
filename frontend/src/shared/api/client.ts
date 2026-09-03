import { ApiProblem, isApiProblem, type ApiProblemPayload } from "./models";
import { basicAuthorization, type RuntimeAccess } from "./runtime-config";

type FetchLike = typeof fetch;
type RequestOptions = { signal?: AbortSignal; body?: unknown; headers?: HeadersInit };

const genericProblem = (): ApiProblem =>
  new ApiProblem({
    code: "NETWORK_ERROR",
    message: "요청을 처리하지 못했습니다.",
    retryable: true,
  });

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly access: () => RuntimeAccess | undefined,
    private readonly fetcher: FetchLike = (...args) => globalThis.fetch(...args),
  ) {}

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>("GET", path, { signal });
  }
  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>("POST", path, { body, signal });
  }
  put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>("PUT", path, { body, signal });
  }
  async delete(path: string, body?: unknown, signal?: AbortSignal): Promise<void> {
    const response = await this.raw("DELETE", path, { body, signal });
    if (!response.ok) throw await this.problem(response);
  }

  async download(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await this.raw("POST", path, { body, signal });
    if (!response.ok) throw await this.problem(response);
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "export.bin";
    return { blob: await response.blob(), filename };
  }

  private async request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
    const response = await this.raw(method, path, options);
    if (!response.ok) throw await this.problem(response);
    return (await response.json()) as T;
  }

  private async raw(method: string, path: string, options: RequestOptions): Promise<Response> {
    const authorization = basicAuthorization(this.access());
    try {
      return await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        signal: options.signal,
        headers: {
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(authorization ? { Authorization: authorization } : {}),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw genericProblem();
    }
  }

  private async problem(response: Response): Promise<ApiProblem> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return genericProblem();
    }
    return new ApiProblem(
      isApiProblem(payload)
        ? payload
        : ({
            code: "API_ERROR",
            message: "요청에 실패했습니다.",
            retryable: false,
          } satisfies ApiProblemPayload),
    );
  }
}
