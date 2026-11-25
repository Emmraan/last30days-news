import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
	password: string | Buffer,
	salt: Buffer,
	keylen: number,
	opts: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// S9. Changing these breaks every stored password, so they are constants.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALTLEN = 16;
// 128*N*r is exactly Node's 32 MiB default, so the default always throws.
const MAXMEM = 64 * 1024 * 1024;

/** Same cost as a real hash, so a missing password costs the same as a wrong one. */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$AAAAAAAAAAAAAAAAAAAAAA==$${'A'.repeat(43)}=`;

/** S9 first-run password. It only ever matches while no password is stored. */
export const FIRST_RUN_PASSWORD = 'last30';

/** S19: a local install has no UI at boot, so print the default password. */
export function firstRunNotice() {
	return `\nlast30days-news: first run.\n  Sign in with the default password "${FIRST_RUN_PASSWORD}" and change it in Settings.\n\n`;
}

/**
 * S9: a deployed instance must never advertise the public default. If the
 * first password variable is missing, the owner gets a recovery instruction
 * instead of a password anyone can read from the repository.
 */
export function deploySetupNotice() {
	return (
		'\nlast30days-news: first run on a deployment.\n' +
		'  Set L30_INITIAL_PASSWORD (at least 8 characters) and restart.\n' +
		'  Password reset is disabled on this deployment.\n\n'
	);
}

export async function hashPassword(plain: string): Promise<string> {
	const salt = randomBytes(SALTLEN);
	const hash = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string | null | undefined) {
	// Every path runs exactly one scrypt, so response time never reveals
	// whether a password is set or whether it was close.
	const target = parse(stored) ?? parse(DUMMY_HASH)!;
	const hash = await scrypt(plain, target.salt, target.hash.length, {
		N: target.N,
		r: target.r,
		p: target.p,
		maxmem: MAXMEM
	});
	const match = timingSafeEqual(hash, target.hash);
	return match && parse(stored) !== null;
}

function parse(stored: string | null | undefined) {
	if (!stored) return null;
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
	const [, n, r, p, salt, hash] = parts;
	const N = Number(n);
	const r_ = Number(r);
	const p_ = Number(p);
	if (!Number.isInteger(N) || !Number.isInteger(r_) || !Number.isInteger(p_)) return null;
	if (N < 2 || (N & (N - 1)) !== 0) return null;
	const saltBuf = Buffer.from(salt, 'base64');
	const hashBuf = Buffer.from(hash, 'base64');
	if (saltBuf.length !== SALTLEN || hashBuf.length !== KEYLEN) return null;
	return { N, r: r_, p: p_, salt: saltBuf, hash: hashBuf };
}
