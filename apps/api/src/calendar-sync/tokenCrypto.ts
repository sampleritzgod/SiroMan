import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const STATE_TTL_MS = 15 * 60 * 1000;

function keyFromEnv(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string, encryptionKey: string): string {
  const key = keyFromEnv(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(payload: string, encryptionKey: string): string {
  const key = keyFromEnv(encryptionKey);
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type OAuthStatePayload = {
  userId: string;
  provider: string;
  nonce: string;
  exp: number;
};

export function signOAuthState(
  payload: Omit<OAuthStatePayload, "exp" | "nonce"> & { nonce?: string },
  encryptionKey: string,
): string {
  const body: OAuthStatePayload = {
    userId: payload.userId,
    provider: payload.provider,
    nonce: payload.nonce ?? randomBytes(8).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", encryptionKey).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function verifyOAuthState(
  state: string,
  encryptionKey: string,
): OAuthStatePayload | null {
  const [json, sig] = state.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", encryptionKey).update(json).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (!payload.userId || !payload.provider || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
