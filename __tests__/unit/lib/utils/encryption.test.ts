import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, maskApiKey, isEncrypted } from '@/lib/utils/encryption';

describe('encryption utilities', () => {
  beforeEach(() => {
    // Ensure valid encryption key is set
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const original = 'sk-my-secret-api-key-12345';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext for same input (random IV)', () => {
      const original = 'same-text';
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decrypt(encrypted1)).toBe(original);
      expect(decrypt(encrypted2)).toBe(original);
    });

    it('should handle empty string', () => {
      const original = '';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle unicode characters', () => {
      const original = 'Hello, 世界! 🌍 Привет';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle long strings', () => {
      const original = 'x'.repeat(10000);
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle special characters', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle newlines and whitespace', () => {
      const original = 'line1\nline2\ttabbed\r\nwindows line';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce encrypted output in correct format (iv:authTag:data)', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/i); // IV is hex
      expect(parts[1]).toMatch(/^[0-9a-f]+$/i); // Auth tag is hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/i); // Encrypted data is hex
    });

    it('should throw on invalid encrypted format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted text format');
      expect(() => decrypt('only:two')).toThrow('Invalid encrypted text format');
      expect(() => decrypt('')).toThrow('Invalid encrypted text format');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      // Tamper with the encrypted data
      parts[2] = 'ff' + parts[2].slice(2);
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      // Tamper with the auth tag
      parts[1] = 'ff' + parts[1].slice(2);
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key showing first 4 and last 4 characters', () => {
      const key = 'sk-1234567890abcdef';
      expect(maskApiKey(key)).toBe('sk-1****cdef');
    });

    it('should return **** for short keys (8 or fewer chars)', () => {
      expect(maskApiKey('short')).toBe('****');
      expect(maskApiKey('12345678')).toBe('****');
    });

    it('should handle exactly 9 character key', () => {
      expect(maskApiKey('123456789')).toBe('1234****6789');
    });

    it('should handle empty string', () => {
      expect(maskApiKey('')).toBe('');
    });

    it('should handle typical OpenAI API key format', () => {
      const key = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
      const masked = maskApiKey(key);
      expect(masked.startsWith('sk-p')).toBe(true);
      expect(masked.endsWith('34yz')).toBe(true);
      expect(masked).toContain('****');
      expect(masked.length).toBe(12);
    });

    it('should handle typical Anthropic API key format', () => {
      const key = 'sk-ant-api03-abcdef123456-ghijkl789012';
      const masked = maskApiKey(key);
      expect(masked.startsWith('sk-a')).toBe(true);
      expect(masked.endsWith('9012')).toBe(true);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted text', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('not encrypted')).toBe(false);
      expect(isEncrypted('sk-api-key-here')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isEncrypted(null as unknown as string)).toBe(false);
      expect(isEncrypted(undefined as unknown as string)).toBe(false);
    });

    it('should return false for partial format', () => {
      expect(isEncrypted('abc:def')).toBe(false);
      expect(isEncrypted('only-one-part')).toBe(false);
    });

    it('should return false for non-hex format', () => {
      expect(isEncrypted('abc:def:ghi')).toBe(false); // 'ghi' is not valid hex
      expect(isEncrypted('ZZZZ:YYYY:XXXX')).toBe(false);
    });

    it('should return true for valid hex format with 3 parts', () => {
      expect(isEncrypted('abcd1234:ef567890:abcdef012345')).toBe(true);
    });
  });

  describe('encryption key validation', () => {
    it('should throw when encryption key is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be set');
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should throw when encryption key is wrong length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be set');
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });
});
