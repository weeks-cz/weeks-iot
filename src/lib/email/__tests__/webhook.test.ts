import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "../webhook";

const SECRET_BYTES = randomBytes(24);
const SECRET = `v1,whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: number, body: string, key = SECRET_BYTES): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

function headers(over: Record<string, string | null> = {}): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(over)) {
    if (v !== null) h.set(k, v);
  }
  return h;
}

function validRequest(body: string, secret = SECRET_BYTES) {
  const id = "msg_2abc";
  const ts = Math.floor(Date.now() / 1000);
  return {
    body,
    headers: headers({
      "webhook-id": id,
      "webhook-timestamp": String(ts),
      "webhook-signature": `v1,${sign(id, ts, body, secret)}`,
    }),
  };
}

const BODY = JSON.stringify({ user: { email: "rodic@example.com" } });

describe("verifyWebhookSignature", () => {
  it("přijme správně podepsaný požadavek", () => {
    const req = validRequest(BODY);
    expect(verifyWebhookSignature(req.body, req.headers, SECRET).ok).toBe(true);
  });

  it("přijme klíč vložený i bez prefixu", () => {
    // Uživatel klíč z dashboardu vloží někdy s "v1,whsec_", někdy bez.
    const req = validRequest(BODY);
    expect(verifyWebhookSignature(req.body, req.headers, SECRET_BYTES.toString("base64")).ok).toBe(true);
    expect(verifyWebhookSignature(req.body, req.headers, `whsec_${SECRET_BYTES.toString("base64")}`).ok).toBe(true);
  });

  it("odmítne požadavek bez hlaviček", () => {
    const result = verifyWebhookSignature(BODY, headers(), SECRET);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/hlavičky/i);
  });

  it("odmítne podpis vyrobený jiným klíčem", () => {
    // Tohle je ten útok, který ověření brání: cizí endpoint by si nechal
    // poslat přihlašovací odkaz na vlastní adresu.
    const req = validRequest(BODY, randomBytes(24));
    expect(verifyWebhookSignature(req.body, req.headers, SECRET).ok).toBe(false);
  });

  it("odmítne pozměněné tělo", () => {
    const req = validRequest(BODY);
    const tampered = JSON.stringify({ user: { email: "utocnik@example.com" } });
    expect(verifyWebhookSignature(tampered, req.headers, SECRET).ok).toBe(false);
  });

  it("odmítne staré časové razítko", () => {
    // Bez tolerance by šlo odchycený požadavek přehrát kdykoli později.
    const id = "msg_old";
    const ts = Math.floor(Date.now() / 1000) - 3600;
    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": id,
        "webhook-timestamp": String(ts),
        "webhook-signature": `v1,${sign(id, ts, BODY)}`,
      }),
      SECRET,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/toleranc/i);
  });

  it("odmítne razítko z budoucnosti", () => {
    const id = "msg_future";
    const ts = Math.floor(Date.now() / 1000) + 3600;
    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": id,
        "webhook-timestamp": String(ts),
        "webhook-signature": `v1,${sign(id, ts, BODY)}`,
      }),
      SECRET,
    );
    expect(result.ok).toBe(false);
  });

  it("odmítne nečíselné razítko", () => {
    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": "msg_1",
        "webhook-timestamp": "not-a-number",
        "webhook-signature": "v1,cosi",
      }),
      SECRET,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/razítko/i);
  });

  it("uspěje, když sedí aspoň jeden podpis z několika", () => {
    // Při rotaci klíče posílá odesílatel víc podpisů najednou.
    const id = "msg_rotace";
    const ts = Math.floor(Date.now() / 1000);
    const good = sign(id, ts, BODY);
    const stale = sign(id, ts, BODY, randomBytes(24));

    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": id,
        "webhook-timestamp": String(ts),
        "webhook-signature": `v1,${stale} v1,${good}`,
      }),
      SECRET,
    );
    expect(result.ok).toBe(true);
  });

  it("ignoruje podpisy neznámé verze", () => {
    const id = "msg_v2";
    const ts = Math.floor(Date.now() / 1000);
    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": id,
        "webhook-timestamp": String(ts),
        "webhook-signature": `v2,${sign(id, ts, BODY)}`,
      }),
      SECRET,
    );
    expect(result.ok).toBe(false);
  });

  it("odmítne prázdný podepisovací klíč", () => {
    const req = validRequest(BODY);
    const result = verifyWebhookSignature(req.body, req.headers, "");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/klíč/i);
  });

  it("podpis závisí na webhook-id, ne jen na těle", () => {
    const ts = Math.floor(Date.now() / 1000);
    const result = verifyWebhookSignature(
      BODY,
      headers({
        "webhook-id": "msg_jine",
        "webhook-timestamp": String(ts),
        "webhook-signature": `v1,${sign("msg_puvodni", ts, BODY)}`,
      }),
      SECRET,
    );
    expect(result.ok).toBe(false);
  });
});
