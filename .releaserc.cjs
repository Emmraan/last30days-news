const plugins = [
	'@semantic-release/commit-analyzer',
	'@semantic-release/release-notes-generator',
	'@semantic-release/github'
];

// npm is optional until the account is available. Adding NPM_TOKEN to the
// release environment enables publishing without another code change.
if (process.env.NPM_TOKEN) {
	plugins.push(['@semantic-release/npm', { npmPublish: true, provenance: true }]);
}

module.exports = {
	branches: ['main'],
	tagFormat: 'v${version}',
	plugins
};
