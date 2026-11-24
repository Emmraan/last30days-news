import type { PageServerLoad } from './$types';
import { resetAllowed } from '#lib/server/auth/deployment';

export const load: PageServerLoad = async ({ locals }) => ({
	canReset: resetAllowed(locals.ip)
});
