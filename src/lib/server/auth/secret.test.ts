import { randomBytes } from 'node:crypto';
import { expect, test } from 'vitest';
import { decryptSecret, deriveKey, encryptSecret, newSalt } from './secret';

const salt = Buffer.alloc(16, 7);
const key = deriveKey('hunter2hunter2', salt);

test('deriveKey is deterministic, 32 bytes, and salt-sensitive', () => {
	const a = deriveKey('pw', salt);
	const b = deriveKey('pw', salt);
	const c = deriveKey('pw', Buffer.alloc(16, 8));
	expect(a).toHaveLength(32);
	expect(a.equals(b)).toBe(true);
	expect(a.equals(c)).toBe(false);
});

test('newSalt returns 16 random bytes, different each call', () => {
	const a = newSalt();
	expect(a).toHaveLength(16);
	expect(a.equals(newSalt())).toBe(false);
});

test('round-trips ascii, empty and unicode', () => {
	for (const plain of ['', 'sk-abc123', 'ключ-🔑-日本']) {
		expect(decryptSecret(key, encryptSecret(key, plain))).toBe(plain);
	}
});

test('payload is iv.tag.ciphertext, iv is 12 bytes', () => {
	const parts = encryptSecret(key, 'x').split('.');
	expect(parts).toHaveLength(3);
	expect(Buffer.from(parts[0], 'base64')).toHaveLength(12);
	expect(Buffer.from(parts[1], 'base64')).toHaveLength(16);
});

test('two encryptions of the same plaintext differ (random iv)', () => {
	expect(encryptSecret(key, 'same')).not.toBe(encryptSecret(key, 'same'));
});

test('a different key cannot decrypt', () => {
	const other = deriveKey('different-password', salt);
	expect(() => decryptSecret(other, encryptSecret(key, 'secret'))).toThrow();
});

test('a tampered tag, ciphertext or iv is rejected', () => {
	const [iv, tag, ct] = encryptSecret(key, 'secret').split('.');
	const flip = (b64: string) => {
		const buf = Buffer.from(b64, 'base64');
		buf[0] ^= 1;
		return buf.toString('base64');
	};
	expect(() => decryptSecret(key, `${iv}.${flip(tag)}.${ct}`)).toThrow();
	expect(() => decryptSecret(key, `${iv}.${tag}.${flip(ct)}`)).toThrow();
	expect(() => decryptSecret(key, `${flip(iv)}.${tag}.${ct}`)).toThrow();
});

test('a malformed payload is rejected', () => {
	for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '!!!.!!!.!!!']) {
		expect(() => decryptSecret(key, bad)).toThrow();
	}
});

test('ciphertext of a key is not the plaintext', () => {
	const plain = 'sk-live-abcdef';
	const payload = encryptSecret(key, plain);
	expect(payload).not.toContain(plain);
	expect(Buffer.from(payload.split('.')[2], 'base64').toString()).not.toBe(plain);
});

test('a random key of the wrong length is rejected rather than silently truncated', () => {
	expect(() => encryptSecret(randomBytes(16), 'x')).toThrow();
});
