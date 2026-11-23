import type { Cookies } from '@sveltejs/kit';
import type { Db } from '#lib/server/db';

/** Minimal cookie jar so route handlers can be exercised without a server. */
export function cookieJar() {
	const jar = new Map<string, string>();
	const opts = new Map<string, Record<string, unknown>>();
	const cookies: Cookies = {
		get: (name: string) => jar.get(name),
		getAll: () => [...jar].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string, o?: unknown) => {
			jar.set(name, value);
			if (o) opts.set(name, o as Record<string, unknown>);
		},
		delete: (name: string) => {
			jar.delete(name);
			opts.delete(name);
		},
		serialize: () => ''
	} as unknown as Cookies;
	return { cookies, jar, opts };
}

type EventInit = {
	db: Db;
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
	url?: string;
	cookies?: ReturnType<typeof cookieJar>;
	params?: Record<string, string>;
	sessionId?: string;
	mustChangePassword?: boolean;
	ip?: string;
	vaultKey?: Buffer;
	fetch?: typeof globalThis.fetch;
};

/** Builds the subset of RequestEvent a `+server.ts` handler actually reads. */
export function makeEvent(init: EventInit) {
	const jar = init.cookies ?? cookieJar();
	const url = new URL(init.url ?? 'http://127.0.0.1:4477/api/auth/login');
	const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
	const headers = new Headers(init.headers);
	let body: string | undefined;
	if (init.body !== undefined) {
		body = JSON.stringify(init.body);
		headers.set('content-type', 'application/json');
		if (!headers.has('origin')) headers.set('origin', url.origin);
	}
	return {
		event: {
			request: new Request(url, { method, headers, body }),
			url,
			cookies: jar.cookies,
			params: init.params ?? {},
			locals: {
				db: init.db,
				sessionId: init.sessionId,
				mustChangePassword: init.mustChangePassword ?? false,
				ip: init.ip ?? '127.0.0.1',
				vaultKey: init.vaultKey
			},
			platform: undefined,
			route: { id: null },
			setHeaders: () => {},
			isDataRequest: false,
			isSubRequest: false,
			fetch: init.fetch ?? globalThis.fetch
		} as never,
		jar
	};
}

/** Reads the JSON body plus status of a route response. */
export async function read(res: Response) {
	const text = await res.text();
	return {
		status: res.status,
		headers: res.headers,
		body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
		raw: text
	};
}
