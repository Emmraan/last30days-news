#!/bin/sh
# Removes everything this project installs on one machine, and leaves unrelated
# services alone. Run as your normal user; sudo is used only for system paths.
set -u

say() {
	printf '%s\n' "$*"
}

as_root() {
	if [ "$(id -u)" -eq 0 ]; then
		"$@"
	elif command -v sudo >/dev/null 2>&1; then
		sudo "$@"
	else
		"$@"
	fi
}

remove_path() {
	[ -n "$1" ] && [ -e "$1" ] || return 0
	rm -rf "$1" && say "Removed $1"
}

if command -v npm >/dev/null 2>&1; then
	npm uninstall --global last30days-news >/dev/null 2>&1 || true
	say "Removed the global npm package if it was installed."

	cache=$(npm config get cache 2>/dev/null || true)
	if [ -n "$cache" ] && [ -d "$cache/_npx" ]; then
		find "$cache/_npx" -type d -path '*/node_modules/last30days-news' -prune \
			-exec rm -rf {} + 2>/dev/null || true
		say "Removed cached npx copies if any were present."
	fi
else
	say "npm is not installed; skipped the npm package."
fi

home=${HOME:-}
if [ -n "$home" ]; then
	remove_path "$home/Library/Application Support/last30days-news"
	remove_path "${XDG_DATA_HOME:-$home/.local/share}/last30days-news"
fi
if [ -n "${L30_DATA_DIR:-}" ]; then
	remove_path "$L30_DATA_DIR"
fi

if command -v docker >/dev/null 2>&1; then
	if as_root docker info >/dev/null 2>&1; then
		if as_root docker container inspect last30days-news >/dev/null 2>&1; then
			as_root docker rm -f last30days-news >/dev/null
			say "Removed the Docker container."
		fi
		if as_root docker volume inspect last30days-data >/dev/null 2>&1; then
			as_root docker volume rm last30days-data >/dev/null
			say "Removed the Docker volume."
		fi
		if as_root docker image inspect ghcr.io/emmraan/last30days-news:latest >/dev/null 2>&1; then
			as_root docker image rm ghcr.io/emmraan/last30days-news:latest >/dev/null
			say "Removed the Docker image."
		fi
	else
		say "Docker is installed but not reachable; skipped the Docker cleanup."
	fi
fi

unit=/etc/systemd/system/last30days-news.service
if [ -f "$unit" ] && command -v systemctl >/dev/null 2>&1; then
	as_root systemctl disable --now last30days-news >/dev/null 2>&1 || true
	as_root rm -f "$unit"
	as_root systemctl daemon-reload >/dev/null 2>&1 || true
	say "Removed the systemd unit."
fi

for path in /opt/last30days-news /var/lib/last30days-news /etc/last30days-news.env; do
	if [ -e "$path" ]; then
		as_root rm -rf "$path"
		say "Removed $path"
	fi
done

if id last30days >/dev/null 2>&1; then
	as_root userdel last30days >/dev/null 2>&1 || true
	say "Removed the last30days user."
fi

say ""
say "Done. Caddy and Vercel settings are not touched."
say "Remove the Caddy site block or the Vercel project by hand if you used them."
