import type { Db } from '#lib/server/db';

declare module '*.sql?raw' {
	const sql: string;
	export default sql;
}

declare global {
	namespace App {
		interface Locals {
			db: Db;
			sessionId: string | undefined;
			mustChangePassword: boolean;
			ip: string;
			/** Derived from the password and carried by an HttpOnly cookie, not stored in the DB. */
			vaultKey: Buffer | undefined;
		}
	}
}

export {};
