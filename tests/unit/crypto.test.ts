import { describe, it, expect } from 'vitest';
import {
  generateEncryptionKey,
  exportKeyToBase64,
  importKeyFromBase64,
  encryptPayload,
  decryptPayload,
  buildEncryptedRoomUrl,
} from '../../frontend/src/engine/crypto';

describe('Zero-Knowledge End-to-End Encryption (AES-GCM 256-bit)', () => {
  it('generates, exports, and imports 256-bit AES-GCM keys via Web Crypto API', async () => {
    const key = await generateEncryptionKey();
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');

    const keyBase64 = await exportKeyToBase64(key);
    expect(typeof keyBase64).toBe('string');
    expect(keyBase64.length).toBeGreaterThan(20);

    const importedKey = await importKeyFromBase64(keyBase64);
    expect(importedKey.algorithm.name).toBe('AES-GCM');
    expect(importedKey.extractable).toBe(true);
  });

  it('encrypts and decrypts Uint8Array payloads correctly', async () => {
    const key = await generateEncryptionKey();
    const secretMessage = 'GFG Draw Zero-Knowledge Architecture Confidential Specs';
    const encoder = new TextEncoder();
    const rawPayload = encoder.encode(secretMessage);

    const encrypted = await encryptPayload(rawPayload, key);
    expect(encrypted.byteLength).toBeGreaterThan(rawPayload.byteLength);

    const decrypted = await decryptPayload(encrypted, key);
    const decoder = new TextDecoder();
    const recoveredMessage = decoder.decode(decrypted);

    expect(recoveredMessage).toBe(secretMessage);
  });

  it('fails decryption gracefully when using an incorrect key', async () => {
    const keyA = await generateEncryptionKey();
    const keyB = await generateEncryptionKey();

    const rawPayload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const encrypted = await encryptPayload(rawPayload, keyA);

    await expect(decryptPayload(encrypted, keyB)).rejects.toThrow();
  });

  it('constructs room URLs with client-side key fragments without leaking to query params', () => {
    const url = buildEncryptedRoomUrl('studio-room-1', 'testKeyBase64Secret');
    expect(url).toContain('room=studio-room-1');
    expect(url).toContain('#key=testKeyBase64Secret');
  });
});

