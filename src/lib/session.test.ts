import { describe, it, expect } from "vitest";
import { capacityLevel, parseTag } from "./session";

describe("capacityLevel", () => {
  it("flags near capacity at 80%", () => {
    expect(capacityLevel(80, 100).level).toBe("near");
    expect(capacityLevel(79, 100).level).toBe("ok");
  });
  it("flags full at capacity", () => {
    expect(capacityLevel(100, 100).level).toBe("full");
  });
});

describe("parseTag", () => {
  it("reads codes from text and tap URLs", () => {
    expect(parseTag("lib-01")).toBe("LIB-01");
    expect(parseTag("https://x.app/tap/SCI-01?x=1")).toBe("SCI-01");
  });
});
