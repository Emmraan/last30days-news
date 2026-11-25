/**
 * §S9: reset exists for the person who owns the machine and the database
 * file. A public deployment has no such person, so reset is loopback only on
 * a local install and off entirely once the app is marked as deployed.
 */
export function isLoopback(ip: string | undefined): boolean {
	if (!ip) return false;
	const value = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
	return (
		value === '::1' ||
		value === '0:0:0:0:0:0:0:1' ||
		value.startsWith('127.') ||
		value.startsWith('::ffff:127.')
	);
}

/** Vercel sets VERCEL=1; Docker and VPS installs set L30_DEPLOYED=1. */
export function isDeployed(env: Record<string, string | undefined> = process.env): boolean {
	return env.VERCEL === '1' || env.L30_DEPLOYED === '1';
}

export function resetAllowed(
	ip: string | undefined,
	env: Record<string, string | undefined> = process.env
): boolean {
	return !isDeployed(env) && isLoopback(ip);
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * A deployed instance must never start with the public default password.
 * The operator supplies the first password once; after that the stored hash
 * is the only source of truth, so changing this variable changes nothing.
 */
export function initialPassword(env: Record<string, string | undefined> = process.env): string | null {
	const value = env.L30_INITIAL_PASSWORD;
	if (!value || value.length < MIN_PASSWORD_LENGTH || value.length > 1024) return null;
	return value;
}
