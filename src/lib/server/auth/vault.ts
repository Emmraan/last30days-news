import { deriveKey, newSalt } from './secret';
import { deleteSettingsByPrefix, getSetting, listSettingsByPrefix, setSetting } from '../settings';
import type { Db } from '../db';

export const SALT_KEY = 'crypto.salt';
export const SECRET_PREFIX = 'secret.';

export async function getSalt(db: Db): Promise<Buffer | null> {
	const stored = await getSetting<string>(db, SALT_KEY);
	return stored ? Buffer.from(stored, 'base64') : null;
}

/** A salt exists from the first login, not from the first secret written. */
export async function ensureSalt(db: Db): Promise<Buffer> {
	const existing = await getSalt(db);
	if (existing) return existing;
	const salt = newSalt();
	await setSetting(db, SALT_KEY, salt.toString('base64'));
	return salt;
}

/** S9: key = scrypt(password, crypto.salt). */
export async function keyFor(db: Db, password: string): Promise<Buffer> {
	return deriveKey(password, await ensureSalt(db));
}

export async function listSecrets(db: Db): Promise<Record<string, string>> {
	const rows = await listSettingsByPrefix(db, SECRET_PREFIX);
	return Object.fromEntries(rows.map((r) => [r.key, String(r.value)]));
}

export async function deleteSecrets(db: Db) {
	await deleteSettingsByPrefix(db, SECRET_PREFIX);
}
