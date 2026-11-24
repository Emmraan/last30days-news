import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The app has no public home: signed-in readers belong in the feed, everyone
// else needs the password screen. The marketing site lives in landing/.
export const load: PageServerLoad = ({ locals }) => {
	redirect(303, locals.sessionId ? '/app' : '/login');
};
