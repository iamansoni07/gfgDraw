/**
 * Zero-Knowledge End-to-End Encryption (E2EE) Engine for GFG Draw:
 * Uses the native Web Crypto API (AES-GCM 256-bit) to encrypt room payloads client-side.
 * The encryption key is held strictly in the browser URL fragment (#key=<base64>),
 * meaning the WebSocket relay server never sees or stores plaintext board data.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    return (globalThis as any).crypto;
  }
  throw new Error('Web Crypto API is not available in the current environment.');
}

/**
 * Generates a fresh 256-bit AES-GCM encryption key.
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  const cryptoObj = getCrypto();
  return await cryptoObj.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey into a URL-safe Base64 string.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const cryptoObj = getCrypto();
  const raw = await cryptoObj.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const toBase64 = typeof btoa === 'function' ? btoa : (s: string) => Buffer.from(s, 'binary').toString('base64');
  return toBase64(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Imports a CryptoKey from a URL-safe Base64 string.
 */
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const cryptoObj = getCrypto();
  // Convert URL-safe base64 back to standard base64
  let standard = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (standard.length % 4) {
    standard += '=';
  }

  const fromBase64 = typeof atob === 'function' ? atob : (s: string) => Buffer.from(s, 'base64').toString('binary');
  const binary = fromBase64(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return await cryptoObj.subtle.importKey(
    'raw',
    bytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data (Uint8Array or string) using AES-GCM.
 * Output format: [12-byte IV (random nonce)] + [Ciphertext + Auth Tag]
 */
export async function encryptPayload(
  data: Uint8Array | string,
  key: CryptoKey
): Promise<Uint8Array> {
  const cryptoObj = getCrypto();
  const rawBytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : data;

  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await cryptoObj.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    rawBytes as unknown as BufferSource
  );

  const cipherBytes = new Uint8Array(ciphertext);
  const packed = new Uint8Array(iv.length + cipherBytes.length);
  packed.set(iv, 0);
  packed.set(cipherBytes, iv.length);

  return packed;
}

/**
 * Decrypts a packed AES-GCM payload [12-byte IV + Ciphertext].
 */
export async function decryptPayload(
  packed: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  if (packed.length < IV_LENGTH + 16) {
    throw new Error('Invalid encrypted payload: too short for IV and authentication tag.');
  }

  const cryptoObj = getCrypto();
  const iv = packed.subarray(0, IV_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH);

  const decrypted = await cryptoObj.subtle.decrypt(
    { name: ALGORITHM, iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Reads the encryption key from window.location.hash if present (#key=...).
 */
export function getUrlEncryptionKey(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const hash = window.location.hash;
  const match = hash.match(/[#&]key=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Generates an encrypted room link containing the room ID and #key=<base64>.
 */
export function buildEncryptedRoomUrl(roomId: string, keyBase64: string): string {
  const base =
    typeof window !== 'undefined' && window.location
      ? window.location.origin + window.location.pathname
      : 'https://gfgdraw.app/';
  const url = new URL(base);
  url.searchParams.set('room', roomId);
  url.hash = `key=${keyBase64}`;
  return url.toString();
}

/**
 * Checks if the current browser session is running with active E2EE.
 */
export function isSessionEncrypted(): boolean {
  return getUrlEncryptionKey() !== null;
}

