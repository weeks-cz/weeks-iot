import { describe, it, expect } from "vitest";
import {
  korunyToHalere, mapComgateStatus, buildCreateParams,
  parseCreateResponse, verifyCallbackIdentity,
  type ComgateConfig,
} from "@/lib/payments/comgate";

const cfg: ComgateConfig = { merchant: "m1", secret: "s1", test: true, method: "ALL" };
const input = {
  paymentId: "pay-123", priceKc: 79, label: "Weeks Premium — měsíční",
  email: "rodic@example.cz", returnBaseUrl: "https://iot.weeks.cz",
};

describe("comgate client (subscription variant)", () => {
  it("převádí Kč na haléře", () => {
    expect(korunyToHalere(79)).toBe(7900);
    expect(korunyToHalere(699)).toBe(69900);
  });
  it("mapuje stavy", () => {
    expect(mapComgateStatus("PAID")).toBe("paid");
    expect(mapComgateStatus("CANCELLED")).toBe("cancelled");
    expect(mapComgateStatus("PENDING")).toBe("pending");
    expect(mapComgateStatus("cokoliv")).toBe("pending");
  });
  it("staví create params s refId=paymentId a cenou v haléřích", () => {
    const p = buildCreateParams(input, cfg);
    expect(p.get("merchant")).toBe("m1");
    expect(p.get("secret")).toBe("s1");
    expect(p.get("refId")).toBe("pay-123");
    expect(p.get("price")).toBe("7900");
    expect(p.get("curr")).toBe("CZK");
    expect(p.get("prepareOnly")).toBe("true");
    expect(p.get("method")).toBe("ALL");
    expect(p.get("email")).toBe("rodic@example.cz");
    expect(p.get("lang")).toBe("cs");
    expect(p.get("country")).toBe("CZ");
    expect(p.get("url_paid")).toBe("https://iot.weeks.cz/premium/dekujeme?paymentId=pay-123");
    expect(p.get("url_pending")).toBe("https://iot.weeks.cz/premium/dekujeme?paymentId=pay-123");
    expect(p.get("url_cancelled")).toBe("https://iot.weeks.cz/premium/zruseno");
  });
  it("parsuje create response", () => {
    const r = parseCreateResponse("code=0&message=OK&transId=AB12-CD34-EF56&redirect=https%3A%2F%2Fpayments.comgate.cz%2Fx");
    expect(r.transId).toBe("AB12-CD34-EF56");
    expect(r.redirect).toBe("https://payments.comgate.cz/x");
  });
  it("ověří identitu callbacku", () => {
    const ok = new URLSearchParams({ merchant: "m1", secret: "s1" });
    const bad = new URLSearchParams({ merchant: "m1", secret: "zle" });
    expect(verifyCallbackIdentity(ok, cfg)).toBe(true);
    expect(verifyCallbackIdentity(bad, cfg)).toBe(false);
  });
});
