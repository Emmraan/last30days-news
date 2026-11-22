import { expect, test } from '@playwright/test';

test('health returns ok and a version', async ({ request }) => {
	const res = await request.get('/api/health');
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.ok).toBe(true);
	expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
});
