import { describe, expect, it } from "vitest";
import { buildRefreshUrl, readBuildId } from "./useAppUpdate";

describe("app update helpers", () => {
  it("reads valid build identifiers", () => {
    expect(readBuildId({ buildId: "release-123" })).toBe("release-123");
    expect(readBuildId({ buildId: 123 })).toBeNull();
    expect(readBuildId(null)).toBeNull();
  });

  it("builds a unique refresh URL without losing existing parameters", () => {
    const refreshUrl = new URL(
      buildRefreshUrl("https://example.com/?demo=1", "release-123", 12345)
    );

    expect(refreshUrl.searchParams.get("demo")).toBe("1");
    expect(refreshUrl.searchParams.get("_update")).toBe("release-123");
    expect(refreshUrl.searchParams.get("_refresh")).toBe("9ix");
  });
});
