import { describe, expect, it } from "vitest";
import { getLocalAutoLoginAccess } from "./runtime-config";

describe("getLocalAutoLoginAccess", () => {
  it("returns no access outside Vite development mode", () => {
    expect(
      getLocalAutoLoginAccess({
        DEV: false,
        MODE: "production",
      }),
    ).toBeUndefined();
    expect(
      getLocalAutoLoginAccess({
        DEV: true,
        MODE: "test",
      }),
    ).toBeUndefined();
  });

  it("returns the default local administrator only for Vite development", () => {
    expect(
      getLocalAutoLoginAccess({
        DEV: true,
        MODE: "development",
      }),
    ).toEqual({ username: "admin", password: "admin1234" });
  });

  it("uses supplied local development credentials when explicitly supplied", () => {
    expect(
      getLocalAutoLoginAccess({
        DEV: true,
        MODE: "development",
        VITE_AIDLC_LOCAL_ADMIN_USERNAME: "local-admin",
        VITE_AIDLC_LOCAL_ADMIN_PASSWORD: "custom-password",
      }),
    ).toEqual({ username: "local-admin", password: "custom-password" });
  });
});
