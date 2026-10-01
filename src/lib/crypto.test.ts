import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const key = randomBytes(32).toString("base64");

describe("encryptSecret", () => {
  it("criptografa e descriptografa", () => {
    const payload = encryptSecret("segredo-da-pluggy", key);
    expect(payload).toMatch(/^v1:/);
    expect(payload).not.toContain("segredo");
    expect(decryptSecret(payload, key)).toBe("segredo-da-pluggy");
  });

  it("usa IV aleatório", () => {
    expect(encryptSecret("x", key)).not.toBe(encryptSecret("x", key));
  });

  it("detecta adulteração e chave errada", () => {
    const payload = encryptSecret("abc", key);
    const parts = payload.split(":");
    parts[3] = Buffer.from("zzz").toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32).toString("base64"))).toThrow();
  });

  it("exige chave de 32 bytes", () => {
    expect(() => encryptSecret("x", randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
