import type { Api } from '@jellyfin/sdk';

export type JellyfinInvalidationType =
	| 'LibraryChanged'
	| 'UserDataChanged'
	| 'UserUpdated'
	| 'RefreshProgress'
	| 'ServerRestarting'
	| 'ServerShuttingDown';

export interface JellyfinSocketMessage<T = unknown> {
	MessageType?: string;
	MessageId?: string;
	Data?: T;
}

export interface JellyfinInvalidation {
	type: JellyfinInvalidationType;
	itemIds: string[];
	data: unknown;
}

export interface InvalidationSubscription {
	close(): void;
	state(): 'unsupported' | 'connecting' | 'open' | 'closed';
}

const INVALIDATION_TYPES = new Set<JellyfinInvalidationType>([
	'LibraryChanged',
	'UserDataChanged',
	'UserUpdated',
	'RefreshProgress',
	'ServerRestarting',
	'ServerShuttingDown'
]);

function websocketUrl(api: Api): string {
	const url = new URL(api.basePath);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = `${url.pathname.replace(/\/$/, '')}/socket`;
	url.search = '';
	url.searchParams.set('api_key', api.accessToken);
	url.searchParams.set('deviceId', api.deviceInfo.id);
	return url.toString();
}

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

export function extractInvalidatedItemIds(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const record = data as Record<string, unknown>;
	const candidates = [
		record.ItemId,
		record.ItemIds,
		record.ItemsAdded,
		record.ItemsRemoved,
		record.ItemsUpdated,
		record.CollectionFolders
	];

	return [
		...new Set(
			candidates.flatMap((candidate) =>
				typeof candidate === 'string' ? [candidate] : strings(candidate)
			)
		)
	];
}

export function subscribeToInvalidations(
	api: Api,
	listener: (event: JellyfinInvalidation) => void,
	options: { reconnect?: boolean; WebSocketImpl?: typeof WebSocket } = {}
): InvalidationSubscription {
	const WebSocketImpl =
		options.WebSocketImpl ?? (typeof window === 'undefined' ? undefined : window.WebSocket);
	if (!WebSocketImpl || !api.accessToken) {
		return { close() {}, state: () => 'unsupported' };
	}

	let socket: WebSocket | undefined;
	let status: ReturnType<InvalidationSubscription['state']> = 'connecting';
	let stopped = false;
	let reconnectAttempt = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

	const connect = () => {
		if (stopped) return;
		status = 'connecting';
		socket = new WebSocketImpl(websocketUrl(api));
		socket.addEventListener('open', () => {
			status = 'open';
			reconnectAttempt = 0;
		});
		socket.addEventListener('message', (event) => {
			if (typeof event.data !== 'string') return;
			let message: JellyfinSocketMessage;
			try {
				message = JSON.parse(event.data) as JellyfinSocketMessage;
			} catch {
				return;
			}

			if (message.MessageType === 'ForceKeepAlive') {
				if (socket?.readyState === WebSocketImpl.OPEN) {
					socket.send(JSON.stringify({ MessageType: 'KeepAlive' }));
				}
				return;
			}

			if (INVALIDATION_TYPES.has(message.MessageType as JellyfinInvalidationType)) {
				listener({
					type: message.MessageType as JellyfinInvalidationType,
					itemIds: extractInvalidatedItemIds(message.Data),
					data: message.Data
				});
			}
		});
		socket.addEventListener('close', () => {
			status = 'closed';
			if (stopped || options.reconnect === false) return;
			const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt++);
			reconnectTimer = setTimeout(connect, delay);
		});
	};

	connect();
	return {
		close() {
			stopped = true;
			status = 'closed';
			if (reconnectTimer) clearTimeout(reconnectTimer);
			socket?.close();
		},
		state: () => status
	};
}
