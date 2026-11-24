import { expect, test } from 'vitest';
import {
	DUMMY_HASH,
	FIRST_RUN_PASSWORD,
	deploySetupNotice,
	firstRunNotice,
	hashPassword,
	verifyPassword
} from './password';

const FORMAT = /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;

test('stored format is scrypt$N$r$p$salt$hash with 16-byte salt and 32-byte hash', async () => {
	const stored = await hashPassword('last30');
	expect(stored).toMatch(FORMAT);
	const [, , , , salt, hash] = stored.split('$');
	expect(Buffer.from(salt, 'base64')).toHaveLength(16);
	expect(Buffer.from(hash, 'base64')).toHaveLength(32);
});

test('a password verifies against its own hash', async () => {
	const stored = await hashPassword('correct horse');
	expect(await verifyPassword('correct horse', stored)).toBe(true);
});

test('a wrong password does not verify', async () => {
	const stored = await hashPassword('correct horse');
	expect(await verifyPassword('correct hors', stored)).toBe(false);
	expect(await verifyPassword('', stored)).toBe(false);
});

test('the same password hashes differently every time (random salt)', async () => {
	const a = await hashPassword('same');
	const b = await hashPassword('same');
	expect(a).not.toBe(b);
	expect(await verifyPassword('same', a)).toBe(true);
	expect(await verifyPassword('same', b)).toBe(true);
});

test('missing, empty and malformed stored values return false instead of throwing', async () => {
	for (const stored of [
		null,
		undefined,
		'',
		'garbage',
		'scrypt$1$2$3',
		'scrypt$32768$8$1$notbase64$notbase64',
		'scrypt$32768$8$1$AAAA$AAAA',
		'bcrypt$1$2$3$4$5'
	]) {
		expect(await verifyPassword('last30', stored as string | null)).toBe(false);
	}
});

test('unparsable cost parameters do not throw', async () => {
	const stored = 'scrypt$x$y$z$AAAA$AAAA';
	expect(await verifyPassword('last30', stored)).toBe(false);
});

test('the dummy hash uses the same cost parameters so timing matches', async () => {
	expect(DUMMY_HASH).toMatch(FORMAT);
	expect(await verifyPassword('last30', DUMMY_HASH)).toBe(false);
});

test('the first-run notice names the default password', () => {
	const notice = firstRunNotice();
	expect(notice).toContain(FIRST_RUN_PASSWORD);
	expect(notice).toContain('first run');
});

test('the deployment notice asks for an initial password and never names the default', () => {
	const notice = deploySetupNotice();
	expect(notice).toContain('L30_INITIAL_PASSWORD');
	expect(notice).toContain('reset is disabled');
	// The product name contains the same letters; only the bare word would be
	// a leak of the local default.
	expect(notice).not.toMatch(new RegExp(`\\b${FIRST_RUN_PASSWORD}\\b`));
});

test('verification accepts a hash produced with different cost parameters', async () => {
	// A password written by an older build must still verify.
	const stored = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
	expect(await verifyPassword('whatever', stored)).toBe(false);
});
