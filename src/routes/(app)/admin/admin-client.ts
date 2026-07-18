import { session } from '$lib/app/session.svelte';

export type CapabilityStatus = 'available' | 'unavailable' | 'misconfigured' | 'degraded';

export interface CapabilityState {
	status: CapabilityStatus;
	message?: string;
}

export interface MaskedIntegration {
	enabled: boolean;
	url: string;
	apiKeyConfigured: boolean;
	mappedUsers?: number;
}

export interface AdminSettings {
	jellyfin: {
		publicUrl: string;
		internalUrl: string;
		serverId: string;
		serverName: string;
		serverVersion?: string;
	} | null;
	integrations: Record<'seerr' | 'sonarr' | 'radarr', MaskedIntegration>;
}

export interface NetworkDiagnostics {
	origin: string;
	deployment: {
		protocol: string;
		host: string;
		port: string;
	};
	jellyfin: {
		publicUrl: string;
		internalUrl: string;
		publicReachableFromContainer: boolean;
		internalReachableFromContainer: boolean;
		cors: 'allowed' | 'blocked' | 'unknown';
		corsAllowOrigin?: string;
		mixedContent: boolean;
		websocketUrl: string;
	};
}

export interface DownloadProgress {
	id: string;
	service: 'sonarr' | 'radarr';
	mediaType: 'series' | 'movie';
	title: string;
	providerIds: { tmdbId?: number; tvdbId?: number };
	progress: number;
	eta?: string;
	state: 'queued' | 'downloading' | 'importing' | 'completed' | 'warning' | 'failed';
	message?: string;
}

export interface DownloadResponse {
	downloads: DownloadProgress[];
	capabilities: Record<'seerr' | 'sonarr' | 'radarr', CapabilityState>;
}

export interface HealthResponse {
	status: string;
	version: string;
	timestamp?: string;
	checks?: { config: boolean; jellyfin: boolean };
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	for (const [name, value] of Object.entries(session.authorizationHeaders)) {
		headers.set(name, value);
	}
	if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

	const response = await fetch(path, { ...init, headers });
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}
	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null && 'error' in payload
				? typeof payload.error === 'string'
					? payload.error
					: typeof payload.error === 'object' &&
						  payload.error !== null &&
						  'message' in payload.error &&
						  typeof payload.error.message === 'string'
						? payload.error.message
						: `Request failed (${response.status}).`
				: `Request failed (${response.status}).`;
		throw new Error(message);
	}
	return payload as T;
}

export function prettyEta(value?: string): string {
	if (!value) return '—';
	const date = new Date(value);
	if (!Number.isNaN(date.getTime())) {
		return new Intl.DateTimeFormat(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			month: date.toDateString() === new Date().toDateString() ? undefined : 'short',
			day: date.toDateString() === new Date().toDateString() ? undefined : 'numeric'
		}).format(date);
	}
	return value;
}
