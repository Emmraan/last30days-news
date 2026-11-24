import type { PageServerLoad } from './$types';
import { isDeployed, resetAllowed } from '#lib/server/auth/deployment';
import { getSetting } from '#lib/server/settings';

export const load: PageServerLoad = async ({ locals }) => {
	const stored = await getSetting(locals.db, 'auth.password');
	const deployed = isDeployed();
	return {
		firstRun: !stored && !deployed,
		setupRequired: !stored && deployed,
		canReset: resetAllowed(locals.ip)
	};
};
