import { expect, test, vi } from 'vitest';
import { load } from '../src/routes/login/+page.server';
import { hashPassword } from '#lib/server/auth/password';
import { setSetting } from '#lib/server/settings';
import { freshDb } from './helper';

type Data = { firstRun: boolean; setupRequired: boolean; canReset: boolean };

test('the login page announces the first run while no password is stored', async () => {
	const { db } = await freshDb();
	const data = (await load({ locals: { db, ip: '127.0.0.1' } } as never)) as Data;
	expect(data).toEqual({ firstRun: true, setupRequired: false, canReset: true });
});

test('the login page drops the first-run hint once a password exists', async () => {
	const { db } = await freshDb();
	await setSetting(db, 'auth.password', await hashPassword('a-real-password'));
	const data = (await load({ locals: { db, ip: '127.0.0.1' } } as never)) as Data;
	expect(data).toEqual({ firstRun: false, setupRequired: false, canReset: true });
});

test('a remote client gets no first-run hint and no reset link', async () => {
	const { db } = await freshDb();
	const data = (await load({ locals: { db, ip: '203.0.113.9' } } as never)) as Data;
	expect(data).toEqual({ firstRun: true, setupRequired: false, canReset: false });
});

test('a deployment without an initial password asks the operator to set one', async () => {
	vi.stubEnv('L30_DEPLOYED', '1');
	try {
		const { db } = await freshDb();
		const data = (await load({ locals: { db, ip: '127.0.0.1' } } as never)) as Data;
		expect(data).toEqual({ firstRun: false, setupRequired: true, canReset: false });
	} finally {
		vi.unstubAllEnvs();
	}
});

test('a deployment with an initial password is ready and never offers reset', async () => {
	vi.stubEnv('L30_DEPLOYED', '1');
	vi.stubEnv('L30_INITIAL_PASSWORD', 'deploy-password-1');
	try {
		const { db } = await freshDb();
		const data = (await load({ locals: { db, ip: '127.0.0.1' } } as never)) as Data;
		expect(data).toEqual({ firstRun: false, setupRequired: false, canReset: false });
	} finally {
		vi.unstubAllEnvs();
	}
});
