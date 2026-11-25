#!/bin/sh
set -eu

required_node="26.13.0"

if ! command -v node >/dev/null 2>&1; then
	printf '%s\n' "Node.js ${required_node} is required. Install it from https://nodejs.org and run this again." >&2
	exit 1
fi

if [ "$(node -p 'process.versions.node')" != "$required_node" ]; then
	printf '%s\n' "Node.js ${required_node} is required. Found $(node -p 'process.versions.node')." >&2
	exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
	printf '%s\n' "npm is required. It ships with Node.js; reinstall Node.js from https://nodejs.org." >&2
	exit 1
fi

release_url="https://github.com/Emmraan/last30days-news/releases/latest/download/last30days-news.tgz"

printf '%s\n' "Installing last30days-news..."
npm install --global "$release_url" --no-fund --no-audit

printf '\n%s\n' "Installed."
printf '%s\n' "Start it with: last30days"
printf '%s\n' "First run password: last30"
printf '%s\n' "Change the password in Settings after you sign in."
