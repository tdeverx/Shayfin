import type { Api } from '@jellyfin/sdk';
import { apiUrl } from './media.js';
import type { CapabilityState, CapabilityStatus } from './types.js';

export type FetchLike = typeof fetch;

export function capabilityStatusForHttp(status: number): CapabilityStatus {
	if (status === 403 || status === 404) return 'unavailable';
	if (status === 400 || status === 409 || status === 422) return 'misconfigured';
	return 'degraded';
}

function unavailableFetch<T>(): CapabilityState<T> {
	return { status: 'unavailable', message: 'Fetch is unavailable in this environment' };
}

function defaultMessage(status: number): string {
	if (status === 403) return 'The current Jellyfin user cannot access this capability';
	if (status === 404) return 'The plugin capability is not installed or not available';
	return `The plugin request failed with status ${status}`;
}

export class PluginHttpClient {
	readonly api: Api;
	readonly fetchImpl?: FetchLike;

	constructor(api: Api, fetchImpl?: FetchLike) {
		this.api = api;
		this.fetchImpl = fetchImpl ?? globalThis.fetch?.bind(globalThis);
	}

	url(path: string, query: Record<string, string | number | boolean | undefined> = {}): string {
		return apiUrl(this.api, path, query);
	}

	async json<T>(
		path: string,
		options: {
			method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
			query?: Record<string, string | number | boolean | undefined>;
			body?: unknown;
			decode: (value: unknown) => T;
		}
	): Promise<CapabilityState<T>> {
		if (!this.fetchImpl) return unavailableFetch();

		try {
			const response = await this.fetchImpl(this.url(path, options.query), {
				method: options.method ?? 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: this.api.authorizationHeader,
					...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
				},
				body: options.body === undefined ? undefined : JSON.stringify(options.body)
			});

			if (!response.ok) {
				return {
					status: capabilityStatusForHttp(response.status),
					statusCode: response.status,
					message: defaultMessage(response.status)
				};
			}

			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.toLowerCase().includes('json')) {
				return {
					status: 'degraded',
					statusCode: response.status,
					message: 'The plugin returned a non-JSON response'
				};
			}

			return {
				status: 'available',
				statusCode: response.status,
				data: options.decode(await response.json())
			};
		} catch (error) {
			return {
				status: 'degraded',
				message: error instanceof Error ? error.message : 'The plugin request failed'
			};
		}
	}

	async resource(path: string): Promise<CapabilityState<{ url: string }>> {
		if (!this.fetchImpl) return unavailableFetch();
		const url = this.url(path);
		try {
			const response = await this.fetchImpl(url, {
				headers: { Authorization: this.api.authorizationHeader }
			});
			if (!response.ok) {
				return {
					status: capabilityStatusForHttp(response.status),
					statusCode: response.status,
					message: defaultMessage(response.status)
				};
			}
			await response.body?.cancel();
			return { status: 'available', statusCode: response.status, data: { url } };
		} catch (error) {
			return {
				status: 'degraded',
				message: error instanceof Error ? error.message : 'The plugin resource request failed'
			};
		}
	}
}

export function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

export function property(record: Record<string, unknown>, ...keys: string[]): unknown {
	for (const key of keys) {
		if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
	}
	return undefined;
}

export function stringProperty(
	record: Record<string, unknown>,
	...keys: string[]
): string | undefined {
	const value = property(record, ...keys);
	return typeof value === 'string' ? value : undefined;
}

export function numberProperty(
	record: Record<string, unknown>,
	...keys: string[]
): number | undefined {
	const value = property(record, ...keys);
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function booleanProperty(
	record: Record<string, unknown>,
	...keys: string[]
): boolean | undefined {
	const value = property(record, ...keys);
	return typeof value === 'boolean' ? value : undefined;
}

export function arrayProperty(record: Record<string, unknown>, ...keys: string[]): unknown[] {
	const value = property(record, ...keys);
	return Array.isArray(value) ? value : [];
}
