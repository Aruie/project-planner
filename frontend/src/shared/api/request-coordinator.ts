export type RequestToken = {
  action: string;
  requestId: number;
  projectEpoch: number;
  signal: AbortSignal;
};

export class RequestCoordinator {
  private nextRequestId = 0;
  private projectEpoch = 0;
  private readonly active = new Map<string, { requestId: number; controller: AbortController }>();

  begin(action: string): RequestToken {
    this.active.get(action)?.controller.abort();
    const controller = new AbortController();
    const requestId = ++this.nextRequestId;
    this.active.set(action, { requestId, controller });
    return { action, requestId, projectEpoch: this.projectEpoch, signal: controller.signal };
  }

  accepts(token: RequestToken): boolean {
    return (
      this.projectEpoch === token.projectEpoch &&
      this.active.get(token.action)?.requestId === token.requestId &&
      !token.signal.aborted
    );
  }

  resetProject(): void {
    this.projectEpoch += 1;
    for (const request of this.active.values()) request.controller.abort();
    this.active.clear();
  }
}
