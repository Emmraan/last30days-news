#!/bin/sh
set -eu

image="ghcr.io/emmraan/last30days-news:latest"
container="last30days-news"
volume="last30days-data"
port="4477"
url="http://127.0.0.1:${port}"

if ! command -v docker >/dev/null 2>&1; then
	printf '%s\n' "Docker is required. Install it from https://docs.docker.com/engine/install/ and run this again." >&2
	exit 1
fi

if ! docker info >/dev/null 2>&1; then
	printf '%s\n' "Docker is installed but not reachable. Start it, or run this command with sudo." >&2
	exit 1
fi

password="${L30_INITIAL_PASSWORD:-}"
generated=0
if [ -z "$password" ]; then
	if command -v openssl >/dev/null 2>&1; then
		password="$(openssl rand -hex 16)"
	else
		password="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
	fi
	generated=1
fi

if [ "${#password}" -lt 8 ] || [ "$password" = "last30" ]; then
	printf '%s\n' "L30_INITIAL_PASSWORD must be at least 8 characters and must not be last30." >&2
	exit 1
fi

printf '%s\n' "Pulling ${image}..."
if ! docker pull "$image"; then
	printf '%s\n' "Pull failed. If the package is private, log in first:" >&2
	printf '%s\n' "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin" >&2
	exit 1
fi

if docker container inspect "$container" >/dev/null 2>&1; then
	printf '%s\n' "Replacing the existing ${container} container. The ${volume} volume is kept."
	docker rm -f "$container" >/dev/null
fi

env_file="$(mktemp)"
trap 'rm -f "$env_file"' EXIT INT TERM
chmod 600 "$env_file"
printf 'L30_INITIAL_PASSWORD=%s\nL30_TRUST_PROXY=1\n' "$password" >"$env_file"

printf '%s\n' "Starting ${container} on ${url}..."
docker run -d \
	--name "$container" \
	--restart unless-stopped \
	-p "127.0.0.1:${port}:4477" \
	-v "${volume}:/data" \
	--env-file "$env_file" \
	"$image" >/dev/null

rm -f "$env_file"
trap - EXIT INT TERM

status=""
i=0
while [ "$i" -lt 30 ]; do
	status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
	if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
		break
	fi
	if [ "$status" = "unhealthy" ] || [ "$status" = "exited" ]; then
		break
	fi
	i=$((i + 1))
	sleep 2
done

printf '\n%s\n' "Installed."
printf '%s\n' "Open: ${url}"
printf '%s\n' "The app listens on 127.0.0.1 only. Put a TLS proxy in front of it for remote access."
if [ "$generated" -eq 1 ]; then
	printf '%s\n' "First password: ${password}"
	printf '%s\n' "Change it in Settings after you sign in."
else
	printf '%s\n' "Using L30_INITIAL_PASSWORD from the environment."
fi
printf '%s\n' "If the ${volume} volume already held a database, its existing password still applies."
printf '%s\n' "The value above only seeds an empty database."
if [ "$status" != "healthy" ] && [ "$status" != "running" ]; then
	printf '%s\n' "The container is not running yet. Check: docker logs ${container}" >&2
	exit 1
fi
printf '%s\n' "Logs: docker logs ${container}"
