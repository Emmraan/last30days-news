import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const KEYLEN = 32;
const IVLEN = 12;
const TAGLEN = 16;
// Node's default maxmem (32 MiB) is exactly 128*N*r for N=32768, r=8, so the
// default rejects the params this app is specified to use.
const MAXMEM = 64 * 1024 * 1024;

export const newSalt = () => randomBytes(16);

/** S9: key = scrypt(password, crypto.salt), 32 bytes. */
export function deriveKey(password: string, salt: Buffer): Buffer {
	return scryptSync(password, salt, KEYLEN, { maxmem: MAXMEM });
}

export function encryptSecret(key: Buffer, plain: string): string {
	if (key.length !== KEYLEN) throw new Error('secret key must be 32 bytes');
	const iv = randomBytes(IVLEN);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(key: Buffer, payload: string): string {
	if (key.length !== KEYLEN) throw new Error('secret key must be 32 bytes');
	const parts = payload.split('.');
	if (parts.length !== 3) throw new Error('malformed secret');
	const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64'));
	if (iv.length !== IVLEN || tag.length !== TAGLEN) throw new Error('malformed secret');
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
