import { eq, like } from 'drizzle-orm';
import type { Db } from './db';
import { setting } from './db/schema';

export async function getSetting<T = string>(db: Db, key: string): Promise<T | null> {
	const [row] = await db.select().from(setting).where(eq(setting.key, key)).limit(1);
	return row ? (row.value as T) : null;
}

export async function setSetting(db: Db, key: string, value: unknown) {
	await db
		.insert(setting)
		.values({ key, value })
		.onConflictDoUpdate({ target: setting.key, set: { value } });
}

export async function deleteSetting(db: Db, key: string) {
	await db.delete(setting).where(eq(setting.key, key));
}

/** Prefix delete, used by reset to drop every `secret.*` row at once. */
export async function deleteSettingsByPrefix(db: Db, prefix: string) {
	await db.delete(setting).where(like(setting.key, `${prefix}%`));
}

export async function listSettingsByPrefix(db: Db, prefix: string) {
	return db
		.select()
		.from(setting)
		.where(like(setting.key, `${prefix}%`))
		.all();
}
