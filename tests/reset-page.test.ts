import { expect, test, vi } from 'vitest';
import { load } from '../src/routes/reset/+page.server';

type Data = { canReset: boolean };

test('the reset page is available from the machine running the reader', async () => {
	const data = (await load({ locals: { ip: '127.0.0.1' } } as never)) as Data;
	expect(data).toEqual({ canReset: true });
});

test('the reset page refuses a remote client', async () => {
	const data = (await load({ locals: { ip: '203.0.113.9' } } as never)) as Data;
	expect(data).toEqual({ canReset: false });
});

test('the reset page is disabled on a deployment', async () => {
	vi.stubEnv('L30_DEPLOYED', '1');
	try {
		const data = (await load({ locals: { ip: '127.0.0.1' } } as never)) as Data;
		expect(data).toEqual({ canReset: false });
	} finally {
		vi.unstubAllEnvs();
	}
});
