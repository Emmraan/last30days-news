import { isRedirect } from '@sveltejs/kit';
import { expect, test } from 'vitest';
import { load } from '../src/routes/+page.server';

function target(sessionId?: string) {
	try {
		load({ locals: { sessionId } } as never);
	} catch (error) {
		if (!isRedirect(error)) throw error;
		return error;
	}
	throw new Error('load did not redirect');
}

test('the root sends a signed-in reader to the feed', () => {
	const result = target('session-id');
	expect(result.status).toBe(303);
	expect(result.location).toBe('/app');
});

test('the root sends everyone else to the password screen', () => {
	const result = target();
	expect(result.status).toBe(303);
	expect(result.location).toBe('/login');
});
