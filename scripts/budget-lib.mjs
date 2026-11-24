/** Assets in rendered HTML are the source of truth for a route's first load. @param {string} html @param {string} [base] @returns {string[]} */
export function parseAssetUrls(html, base = '/') {
	const urls = [];
	const seen = new Set();
	const origin = 'http://last30days.local';
	const baseUrl = new URL(base, origin);
	for (const match of html.matchAll(/(?:^|\s)(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
		const raw = match[1].trim();
		if (!raw || raw.startsWith('//') || raw.startsWith('data:')) continue;
		let url;
		try {
			url = new URL(raw, baseUrl);
		} catch {
			continue;
		}
		if (url.origin !== origin) continue;
		const pathname = decodeURIComponent(url.pathname);
		if (!/\.(?:js|css)$/i.test(pathname) || seen.has(pathname)) continue;
		seen.add(pathname);
		urls.push(pathname);
	}
	return urls;
}

/** Nearest-rank, so a 20-sample p95 is the 19th value rather than an average. @param {number[]} values @param {number} p @returns {number | null} */
export function percentile(values, p) {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = Math.min(100, Math.max(1, p));
	const index = Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1);
	return sorted[index];
}

/** @param {string} name @param {number} value @param {number} limit */
export function checkBudget(name, value, limit) {
	return { name, value, limit, ok: value <= limit };
}

/** @param {string[]} paths @returns {string[]} */
export function fontFiles(paths) {
	return paths.filter((path) => /\.(?:woff2?|ttf|otf|eot)$/i.test(path));
}

/** @param {string} css */
export function hasFontFace(css) {
	return /@font-face\s*\{/i.test(css);
}

/** @param {number} bytes */
export function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
