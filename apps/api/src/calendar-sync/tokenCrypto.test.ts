import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decryptSecret,
  encryptSecret,
  signOAuthState,
  verifyOAuthState,
} from "./tokenCrypto.js";

describe("tokenCrypto", () => {
  const key = "test-encryption-key-for-calendar-sync";

  it("round-trips secrets", () => {
    const enc = encryptSecret("refresh-token-value", key);
    assert.notEqual(enc, "refresh-token-value");
    assert.equal(decryptSecret(enc, key), "refresh-token-value");
  });

  it("signs and verifies oauth state", () => {
    const state = signOAuthState(
      { userId: "user_1", provider: "google" },
      key,
    );
    const payload = verifyOAuthState(state, key);
    assert.ok(payload);
    assert.equal(payload?.userId, "user_1");
    assert.equal(payload?.provider, "google");
  });

  it("rejects tampered state", () => {
    const state = signOAuthState(
      { userId: "user_1", provider: "google" },
      key,
    );
    assert.equal(verifyOAuthState(state + "x", key), null);
  });
});
