#!/bin/sh
set -eu

image="shayfin-smoke:local"
container="shayfin-smoke-$$"
volume="shayfin-smoke-data-$$"
stub_port="${SHAYFIN_SMOKE_JELLYFIN_PORT:-18096}"
stub_url="http://host.docker.internal:$stub_port"
stub_pid=""

cleanup() {
	docker rm -f "$container" >/dev/null 2>&1 || true
	docker volume rm "$volume" >/dev/null 2>&1 || true
	if [ -n "$stub_pid" ]; then kill "$stub_pid" >/dev/null 2>&1 || true; fi
}

trap cleanup EXIT INT TERM

SHAYFIN_SMOKE_JELLYFIN_PORT="$stub_port" node scripts/jellyfin-smoke-stub.mjs >/dev/null 2>&1 &
stub_pid=$!

attempt=0
until node -e "fetch('http://127.0.0.1:$stub_port/System/Info/Public').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; do
	attempt=$((attempt + 1))
	if [ "$attempt" -ge 30 ]; then
		echo "Smoke Jellyfin stub did not start." >&2
		exit 1
	fi
	sleep 1
done

assert_request() {
	expected="$1"
	path="$2"
	method="${3:-GET}"
	body="${4:-}"
	token="${5:-}"
	docker exec "$container" node -e '
		const [expected, path, method, body, token] = process.argv.slice(1);
		const headers = {};
		if (body) headers["Content-Type"] = "application/json";
		if (token) headers.Authorization = `Bearer ${token}`;
		fetch(`http://127.0.0.1:3000${path}`, { method, headers, body: body || undefined })
			.then(async (response) => {
				if (response.status !== Number(expected)) {
					console.error(`${method} ${path}: expected ${expected}, received ${response.status}: ${await response.text()}`);
					process.exit(1);
				}
			})
			.catch((error) => { console.error(error); process.exit(1); });
	' "$expected" "$path" "$method" "$body" "$token"
}

docker build --tag "$image" .
docker volume create "$volume" >/dev/null
docker run --detach \
	--name "$container" \
	--read-only \
	--tmpfs /tmp:rw,noexec,nosuid,size=64m \
	--cap-drop ALL \
	--security-opt no-new-privileges \
	--add-host host.docker.internal:host-gateway \
	--env SHAYFIN_SETUP_TOKEN=smoke-test-only \
	--mount "type=volume,source=$volume,target=/data" \
	--publish 127.0.0.1::3000 \
	"$image" >/dev/null

attempt=0
until docker exec "$container" node -e "fetch('http://127.0.0.1:3000/api/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; do
	attempt=$((attempt + 1))
	if [ "$attempt" -ge 30 ]; then
		docker logs "$container"
		exit 1
	fi
	sleep 1
done

uid="$(docker exec "$container" id -u)"
if [ "$uid" = "0" ]; then
	echo "Smoke test failed: Shayfin is running as root." >&2
	exit 1
fi

assert_request 503 /api/health/ready
assert_request 401 /api/setup/complete POST "{\"setupCode\":\"wrong\",\"jellyfinPublicUrl\":\"$stub_url\",\"jellyfinInternalUrl\":\"$stub_url\",\"jellyfinToken\":\"admin-token\"}"
assert_request 403 /api/setup/complete POST "{\"setupCode\":\"smoke-test-only\",\"jellyfinPublicUrl\":\"$stub_url\",\"jellyfinInternalUrl\":\"$stub_url\",\"jellyfinToken\":\"user-token\"}"
assert_request 201 /api/setup/complete POST "{\"setupCode\":\"smoke-test-only\",\"jellyfinPublicUrl\":\"$stub_url\",\"jellyfinInternalUrl\":\"$stub_url\",\"jellyfinToken\":\"admin-token\"}"
assert_request 409 /api/setup/complete POST "{\"setupCode\":\"smoke-test-only\",\"jellyfinPublicUrl\":\"$stub_url\",\"jellyfinInternalUrl\":\"$stub_url\",\"jellyfinToken\":\"admin-token\"}"
assert_request 200 /api/health/ready
assert_request 200 /api/admin/integrations/seerr PUT "{\"enabled\":true,\"url\":\"$stub_url\",\"apiKey\":\"smoke-secret-key\"}" admin-token

docker exec "$container" test -s /data/config.json
docker exec "$container" test -s /data/secret.key
key_mode="$(docker exec "$container" stat -c %a /data/secret.key)"
if [ "$key_mode" != "600" ]; then
	echo "Smoke test failed: secret.key mode is $key_mode, expected 600." >&2
	exit 1
fi
if docker exec "$container" grep -q 'smoke-secret-key\|admin-token\|user-token' /data/config.json; then
	echo "Smoke test failed: plaintext credentials were persisted." >&2
	exit 1
fi

docker restart "$container" >/dev/null

attempt=0
until docker exec "$container" node -e "fetch('http://127.0.0.1:3000/api/health/ready').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; do
	attempt=$((attempt + 1))
	if [ "$attempt" -ge 30 ]; then
		docker logs "$container"
		exit 1
	fi
	sleep 1
done

docker exec "$container" node -e '
	Promise.all([
		fetch("http://127.0.0.1:3000/api/bootstrap").then((response) => response.json()),
		fetch("http://127.0.0.1:3000/api/admin/integrations/seerr", { headers: { Authorization: "Bearer admin-token" } }).then((response) => response.json()),
		fetch("http://127.0.0.1:3000/api/admin/integrations/seerr/test", { method: "POST", headers: { Authorization: "Bearer admin-token" } }).then((response) => response.json())
	]).then(([bootstrap, integration, test]) => {
		if (!bootstrap.configured || bootstrap.jellyfin?.server?.id !== "smoke-jellyfin") process.exit(1);
		if (!integration.apiKeyConfigured || JSON.stringify(integration).includes("smoke-secret-key")) process.exit(1);
		if (test.status !== "available") process.exit(1);
	}).catch((error) => { console.error(error); process.exit(1); });
'

echo "Docker smoke test passed (UID $uid, setup lock, encrypted config, readiness, and restart persistence verified)."
