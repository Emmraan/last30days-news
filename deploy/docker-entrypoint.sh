#!/bin/sh
set -eu

# A container layer looks writable but disappears with the container. Warn
# instead of refusing, so a quick local run still works.
if [ -r /proc/self/mountinfo ] && ! grep -q ' /data ' /proc/self/mountinfo; then
	echo "last30days-news: warning: /data is not a mounted volume; data will be lost when this container is removed." >&2
fi

exec "$@"
