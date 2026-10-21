import { describe, it, expect } from "vitest";
import { isBlockedIp, isBlockedHostname } from "@/lib/server/ip-guard";

describe("ip-guard", () => {
  it("blocks localhost and private ranges", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("allows public IPs", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});
