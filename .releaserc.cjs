const plugins = [
	'@semantic-release/commit-analyzer',
	'@semantic-release/release-notes-generator',
	'@semantic-release/github'
];

// The plugin always prepares the version so the GitHub release tarball matches
// the tag. NPM_TOKEN only decides whether that tarball is also published.
const npmPublish = Boolean(process.env.NPM_TOKEN);
plugins.push(['@semantic-release/npm', { npmPublish, provenance: npmPublish }]);

module.exports = {
	branches: ['main'],
	tagFormat: 'v${version}',
	plugins
};
