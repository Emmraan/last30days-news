/** §S13: every whitespace token is quoted so FTS5 operators stay literal. */
export function buildFtsQuery(input: string): string {
	const tokens = input
		.replace(/\u0000/g, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	return tokens
		.map((token, index) => {
			const quoted = `"${token.replace(/"/g, '""')}"`;
			return index === tokens.length - 1 ? `${quoted}*` : quoted;
		})
		.join(' AND ');
}
