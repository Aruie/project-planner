import { describe, expect, it } from "vitest";
import { RequestCoordinator } from "./request-coordinator";

describe("RequestCoordinator", () => {
  it("aborts replaced actions and rejects stale completion after project reset", () => {
    const coordinator = new RequestCoordinator();
    const first = coordinator.begin("save");
    const second = coordinator.begin("save");
    expect(first.signal.aborted).toBe(true);
    expect(coordinator.accepts(second)).toBe(true);
    coordinator.resetProject();
    expect(second.signal.aborted).toBe(true);
    expect(coordinator.accepts(second)).toBe(false);
  });
});
