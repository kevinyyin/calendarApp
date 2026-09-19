import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

import { encryptToken, decryptToken } from "@/lib/crypto";

describe("token encryption", () => {
  it("round-trips a plaintext string", () => {
    const ciphertext = encryptToken("ya29.example-refresh-token");
    expect(ciphertext).not.toBe("ya29.example-refresh-token");
    expect(decryptToken(ciphertext)).toBe("ya29.example-refresh-token");
  });

  it("produces different ciphertext for the same input each time", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const ciphertext = encryptToken("secret");
    const tampered = ciphertext.slice(0, -2) + "aa";
    expect(() => decryptToken(tampered)).toThrow();
  });
});
