# Shayfin

Shayfin is a standalone Jellyfin web client built with SvelteKit, TypeScript, and shadcn-svelte. It replaces the client experience without replacing Jellyfin: Jellyfin remains the source of users, libraries, metadata, artwork, playback negotiation, session state, and plugin capabilities.

The application runs as one `adapter-node` container. It does not include nginx, TLS termination, or a second authentication system.

## v1 at a glance

- Movies and episodic video on desktop and mobile browsers
- Jellyfin account login with administrator UI gated by `User.Policy.IsAdministrator`
- Browser-direct Jellyfin images, API requests, WebSockets, and playback
- Direct play, direct stream, and Jellyfin HLS transcoding with custom controls
- Automatic detail-page Theme Songs and Media Segments support through Jellyfin APIs
- Optional Media Bar Enhanced, Home Screen Sections, Achievement Badges, and GetAvatar capabilities
- Muted local and YouTube trailer backdrops with artwork fallback
- Optional Seerr discovery/requests and read-only Sonarr/Radarr download progress
- System-selected light/dark theme using the VRR Luma/neutral token set

Integrations are capabilities, not hard dependencies. If one is absent or unhealthy, only its associated UI is hidden or degraded; `/api/health/live` remains healthy.

## Run with Docker Compose

Requirements: Docker Engine with Compose v2, and a browser-reachable Jellyfin 10.11.x server.

```sh
cp .env.example .env
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

The setup flow asks for:

1. A public Jellyfin URL reachable by every user's browser.
2. An optional internal Jellyfin URL reachable from the Shayfin container.
3. A temporary Jellyfin administrator login.

The browser authenticates directly with Jellyfin. Shayfin revalidates the temporary access token, requires administrator status, stores the server identity, and does not store that token or the administrator password. Completing setup locks the setup endpoint for that data volume.

Day-to-day container commands:

```sh
docker compose logs -f shayfin   # follow application logs
docker compose pull              # fetch a published image, when one is configured
docker compose up -d --build     # rebuild/update this source checkout
docker compose down              # stop Shayfin without deleting its data
```

Do not add `--volumes` to `docker compose down` unless you intentionally want to erase Shayfin's configuration and return to first-run setup.

### Persistent data

Compose creates the `shayfin-data` volume at `/data`. Back up both files together:

- `/data/config.json` — atomically written runtime configuration
- `/data/secret.key` — 32-byte encryption key with mode `0600`

Seerr, Sonarr, and Radarr API keys are encrypted with AES-256-GCM before being written to `config.json`. Losing `secret.key` makes stored integration credentials unrecoverable. Deleting the volume returns Shayfin to first-run setup.

The runtime container uses a non-root user, drops all Linux capabilities, applies `no-new-privileges`, and mounts the root filesystem read-only. `/data` is its only persistent writable path; `/tmp` is an ephemeral `tmpfs`.

## Jellyfin networking

Shayfin deliberately keeps media traffic between the browser and Jellyfin. Plan the two Jellyfin URLs accordingly:

- **Public URL:** used in the browser for authentication, metadata, artwork, WebSockets, and playback. It must resolve and be reachable from user devices.
- **Internal URL:** optional; used only by the Shayfin container for setup validation and health/diagnostic probes. A Docker DNS name such as `http://jellyfin:8096` is valid here when both services share a network.

Because browser requests go directly to Jellyfin:

- Jellyfin must allow the Shayfin origin with CORS.
- An HTTPS Shayfin page must use an HTTPS public Jellyfin URL; browsers block HTTP mixed content.
- The Jellyfin WebSocket endpoint must be reachable from the browser.
- The URL entered during setup should include a reverse-proxy base path if Jellyfin is hosted below one.

Shayfin does not bundle TLS or a reverse proxy. For an HTTPS deployment, provide an external TLS terminator and set `SHAYFIN_ORIGIN` to the exact public Shayfin origin, for example `https://media.example.com`. The public Jellyfin URL must also be HTTPS-reachable. `HOST` and container `PORT` are fixed deployment concerns rather than admin settings.

The admin networking diagnostics report the detected origin, deployment host/port, public and internal reachability, CORS response, mixed-content compatibility, and derived WebSocket URL.

When both public and internal URLs are supplied, setup verifies that they report the same Jellyfin server identity. Credential-bearing server requests use manual redirect handling so Jellyfin tokens and integration API keys are never forwarded to a redirected origin.

## Optional integrations

Configure integrations from the administrator sidebar. Credentials stay server-side and masked responses never return stored API keys.

- **Seerr 3.2+:** concurrent discovery search, requests, request history, and Jellyfin-to-Seerr user synchronization. Shayfin sends the server-side `X-Api-Key` and a server-derived `X-API-User`.
- **Sonarr API v3:** normalized episodic download progress. Read-only; Shayfin does not mutate the queue.
- **Radarr API v3:** normalized movie download progress. Read-only; Shayfin does not mutate the queue.

Non-administrators only receive download entries joined to their Seerr requests. Administrators can inspect the complete normalized queue.

Plugin support is capability-based. Shayfin reads supported plugin APIs and renders the data with its own shadcn-svelte components; it never injects Jellyfin Web scripts or plugin pages. Media Bar Enhanced supplies the preferred rotating hero selection and trailer preferences. Without it, Shayfin promotes the first suitable Home Screen Sections row while skipping resume and next-up sections. Unknown Home Screen Sections are skipped and surfaced in administrator diagnostics.

YouTube trailer URLs are resolved server-side with `youtubei.js` and streamed as muted HTML video so browser autoplay works without embedding YouTube's player UI. YouTube availability can still vary by video and deployment IP; Shayfin falls back to the Jellyfin artwork when a trailer cannot be resolved.

## Local development

Node.js 22 or newer is recommended.

```sh
npm ci
cp .env.example .env
npm run dev
```

The example environment sets `SHAYFIN_DATA_DIR=.data`, keeping development configuration out of the system `/data` path. `.data` is ignored by Git.

Useful commands:

```sh
npm run check          # Svelte and TypeScript diagnostics
npm run lint           # Prettier check and ESLint
npm run test:unit      # Vitest contracts and helpers
npm run test:e2e       # Playwright browser tests
npm run build          # adapter-node production build
npm run start          # run the completed build on port 3000
npm run test:docker    # image, non-root, liveness, and volume smoke test
```

Install Playwright's browsers once before the first E2E run:

```sh
npx playwright install --with-deps
```

For integration and player validation, use real Jellyfin/Seerr/Servarr instances. The player matrix should cover H.264/AAC direct play, an HLS transcode, Safari native HLS, Chromium/Firefox `hls.js`, resume and seek reporting, track changes, subtitles, next episode, theme fade, and segment skipping.

## Environment variables

| Variable           | Default                       | Purpose                                    |
| ------------------ | ----------------------------- | ------------------------------------------ |
| `HOST`             | `0.0.0.0` in the image        | Adapter-node listen address                |
| `PORT`             | `3000`                        | Adapter-node listen port                   |
| `ORIGIN`           | Compose uses `SHAYFIN_ORIGIN` | Exact externally visible Shayfin origin    |
| `SHAYFIN_ORIGIN`   | `http://localhost:3000`       | Compose input used to set `ORIGIN`         |
| `SHAYFIN_PORT`     | `3000`                        | Host port published by Compose             |
| `SHAYFIN_DATA_DIR` | `/data` in production         | Configuration and encryption-key directory |

## Health endpoints

- `GET /api/health/live` confirms the Node process can serve requests. Docker uses this endpoint and it does not fail because an optional service is down.
- `GET /api/health/ready` confirms configuration exists and the configured Jellyfin internal/public URL is reachable. It returns `503` during first-run setup or when Jellyfin cannot be reached.

## Explicit v1 boundaries

Shayfin v1 supports one Jellyfin server per instance, Jellyfin accounts only, movies and episodic video, and desktop/mobile browsers.

Deferred: TV remote/focus navigation, user-configurable themes/settings, full Jellyfin server administration, music libraries, Live TV, casting, offline downloads, multi-server switching, bundled TLS, injected plugin pages, Seasonals, Jellystat, Achievement Badges social/economy features, and GetAvatar pool administration.
