/**
 * Skill file encryption / decryption utilities.
 * Uses AES-256-GCM with a server-side key stored in env.
 * The key is NEVER sent to the client.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Gets the server-side encryption key from env.
 * Falls back to a deterministic key for development.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const envKey = process.env.SKILL_ENCRYPTION_KEY;

  let keyBytes: Uint8Array;
  if (envKey) {
    keyBytes = Buffer.from(envKey, 'hex');
  } else {
    // Dev fallback: derive from a constant (NOT for production)
    const devSecret = 'cortex-skill-marketplace-dev-key-32b';
    keyBytes = new TextEncoder().encode(devSecret.padEnd(32).slice(0, 32));
    console.warn('[Encryption] Using dev key — set SKILL_ENCRYPTION_KEY in production!');
  }

  return crypto.subtle.importKey('raw', keyBytes as unknown as BufferSource, { name: ALGORITHM }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts skill source code before uploading to IPFS.
 * Returns: base64-encoded string of `iv (12 bytes) + ciphertext`
 */
export async function encryptSkillCode(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded.buffer as ArrayBuffer);

  // Combine iv + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypts skill source code after fetching from IPFS.
 * Input: base64-encoded string of `iv (12 bytes) + ciphertext`
 */
export async function decryptSkillCode(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);

  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
