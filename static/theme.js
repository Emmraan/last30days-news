// Runs before the first paint so a saved theme survives a hard reload even
// when the browser refuses the cookie write. The server-rendered class wins
// when present, so this only fills the gap left by a missing cookie.
(() => {
	const root = document.documentElement;
	if (root.classList.contains('dark') || root.classList.contains('light')) return;

	let saved = null;
	try {
		saved = localStorage.getItem('l30-theme');
	} catch {
		// Storage can be blocked; the cookie below is the second chance.
	}

	if (saved !== 'dark' && saved !== 'light') {
		const match = document.cookie.match(/(?:^|;\s*)l30_theme=(dark|light)(?:;|$)/);
		saved = match ? match[1] : null;
	}

	if (saved === 'dark' || saved === 'light') root.classList.add(saved);
})();
