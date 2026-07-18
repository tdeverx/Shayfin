import { z } from 'zod';
import type { ConfigStore } from './config';
import type { NormalizedMediaRequest, SupportedMediaType, UnifiedSearchResult } from './contracts';
import { ApiError } from './errors';
import { integrationJson, requireIntegration, type ResolvedIntegration } from './integrations';

const SeerrUserSchema = z.object({ id: z.number().int().positive() });

const SearchItemSchema = z
	.object({
		id: z.number().int().positive(),
		mediaType: z.string().optional(),
		media_type: z.string().optional(),
		title: z.string().optional(),
		name: z.string().optional(),
		overview: z.string().optional(),
		posterPath: z.string().nullish(),
		backdropPath: z.string().nullish(),
		mediaInfo: z
			.object({
				status: z.union([z.number(), z.string()]).optional(),
				status4k: z.union([z.number(), z.string()]).optional(),
				tmdbId: z.number().int().optional(),
				tvdbId: z.number().int().nullish(),
				requests: z.array(z.object({ status: z.number().int() }).passthrough()).optional()
			})
			.nullish()
	})
	.passthrough();

const RequestSchema = z
	.object({
		id: z.number().int().positive(),
		type: z.enum(['movie', 'tv']),
		status: z.number().int(),
		is4k: z.boolean().default(false),
		createdAt: z.string().optional(),
		updatedAt: z.string().optional(),
		media: z.object({
			tmdbId: z.number().int().positive(),
			tvdbId: z.number().int().positive().nullish()
		}),
		seasons: z
			.array(
				z
					.object({
						seasonNumber: z.number().int().optional(),
						season: z.number().int().optional()
					})
					.passthrough()
			)
			.default([])
	})
	.passthrough();

function normalizeMediaType(value: string | undefined): SupportedMediaType | undefined {
	if (value === 'movie') return 'movie';
	if (value === 'tv') return 'tv';
	return undefined;
}

export function normalizeAvailability(
	value: number | string | null | undefined
): UnifiedSearchResult['availability'] {
	const numeric = typeof value === 'string' ? Number(value) : value;
	switch (numeric) {
		case 2:
			return 'pending';
		case 3:
			return 'processing';
		case 4:
			return 'partial';
		case 5:
			return 'available';
		default:
			return 'unknown';
	}
}

export function normalizeRequestStatus(
	value: number | null | undefined
): NormalizedMediaRequest['status'] | undefined {
	switch (value) {
		case 1:
			return 'pending';
		case 2:
			return 'approved';
		case 3:
			return 'declined';
		case 4:
			return 'failed';
		case 5:
			return 'completed';
		default:
			return undefined;
	}
}

export function dedupeSearchResults(results: UnifiedSearchResult[]): UnifiedSearchResult[] {
	const seen = new Set<string>();
	return results.filter((result) => {
		const key = `${result.mediaType}:${result.providerIds.tmdbId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function normalizeSeerrSearchResponse(payload: unknown): UnifiedSearchResult[] {
	const rawResults = z.object({ results: z.array(z.unknown()) }).parse(payload).results;
	const normalized: UnifiedSearchResult[] = [];

	for (const raw of rawResults) {
		const parsed = SearchItemSchema.safeParse(raw);
		if (!parsed.success) continue;
		const mediaType = normalizeMediaType(parsed.data.mediaType ?? parsed.data.media_type);
		const title = parsed.data.title ?? parsed.data.name;
		if (!mediaType || !title) continue;

		const requestStatus = normalizeRequestStatus(parsed.data.mediaInfo?.requests?.[0]?.status);
		normalized.push({
			source: 'seerr',
			id: `${mediaType}:${parsed.data.id}`,
			mediaType,
			title,
			overview: parsed.data.overview,
			posterPath: parsed.data.posterPath ?? undefined,
			backdropPath: parsed.data.backdropPath ?? undefined,
			providerIds: {
				tmdbId: parsed.data.mediaInfo?.tmdbId ?? parsed.data.id,
				tvdbId: parsed.data.mediaInfo?.tvdbId ?? undefined
			},
			availability: normalizeAvailability(parsed.data.mediaInfo?.status),
			requestStatus,
			requested: requestStatus !== undefined
		});
	}

	return dedupeSearchResults(normalized);
}

export function normalizeSeerrRequests(payload: unknown): NormalizedMediaRequest[] {
	const results = z.object({ results: z.array(z.unknown()) }).parse(payload).results;
	return results.flatMap((raw) => {
		const parsed = RequestSchema.safeParse(raw);
		if (!parsed.success) return [];
		const status = normalizeRequestStatus(parsed.data.status);
		if (!status) return [];
		return [
			{
				id: parsed.data.id,
				mediaType: parsed.data.type,
				providerIds: {
					tmdbId: parsed.data.media.tmdbId,
					tvdbId: parsed.data.media.tvdbId ?? undefined
				},
				status,
				is4k: parsed.data.is4k,
				seasons: parsed.data.seasons.flatMap((season) => {
					const value = season.seasonNumber ?? season.season;
					return value === undefined ? [] : [value];
				}),
				createdAt: parsed.data.createdAt,
				updatedAt: parsed.data.updatedAt
			}
		];
	});
}

export async function resolveSeerrUserId(
	store: ConfigStore,
	jellyfinUserId: string,
	fetcher: typeof fetch = fetch
): Promise<number> {
	const integration = await requireIntegration(store, 'seerr');
	const existing = integration.userMappings?.[jellyfinUserId];
	if (existing) return existing;

	let user: z.infer<typeof SeerrUserSchema>;
	try {
		user = SeerrUserSchema.parse(
			await integrationJson(
				integration,
				`/api/v1/user/jellyfin/${encodeURIComponent(jellyfinUserId)}`,
				{},
				fetcher
			)
		);
	} catch (error) {
		if (error instanceof ApiError) {
			throw new ApiError(
				424,
				'seerr_user_unmapped',
				'This Jellyfin user is not linked to a Seerr account.'
			);
		}
		throw error;
	}

	await store.update((config) => {
		const seerr = config.integrations.seerr;
		if (!seerr) return config;
		seerr.userMappings = { ...seerr.userMappings, [jellyfinUserId]: user.id };
		return config;
	});
	return user.id;
}

export async function seerrSearch(
	integration: ResolvedIntegration,
	userId: number,
	query: string,
	fetcher: typeof fetch = fetch
): Promise<UnifiedSearchResult[]> {
	const payload = await integrationJson(
		integration,
		`/api/v1/search?query=${encodeURIComponent(query)}&page=1`,
		{ userId },
		fetcher
	);
	return normalizeSeerrSearchResponse(payload);
}

export async function seerrRequests(
	integration: ResolvedIntegration,
	userId: number,
	options: { take?: number; skip?: number } = {},
	fetcher: typeof fetch = fetch
): Promise<NormalizedMediaRequest[]> {
	const take = Math.min(Math.max(options.take ?? 50, 1), 1000);
	const skip = Math.max(options.skip ?? 0, 0);
	const payload = await integrationJson(
		integration,
		`/api/v1/request?take=${take}&skip=${skip}&requestedBy=${userId}`,
		{ userId },
		fetcher
	);
	return normalizeSeerrRequests(payload);
}

export async function createSeerrRequest(
	integration: ResolvedIntegration,
	userId: number,
	body: {
		mediaType: SupportedMediaType;
		mediaId: number;
		seasons?: number[] | 'all';
		is4k?: boolean;
	},
	fetcher: typeof fetch = fetch
): Promise<NormalizedMediaRequest> {
	const raw = await integrationJson(
		integration,
		'/api/v1/request',
		{ method: 'POST', userId, body: JSON.stringify(body) },
		fetcher
	);
	const normalized = normalizeSeerrRequests({ results: [raw] })[0];
	if (!normalized)
		throw new ApiError(502, 'invalid_seerr_response', 'Seerr returned invalid data.');
	return normalized;
}

export async function syncSeerrUsers(
	store: ConfigStore,
	integration: ResolvedIntegration,
	jellyfinUserIds: string[],
	fetcher: typeof fetch = fetch
): Promise<{ mapped: number; missing: string[] }> {
	const entries = await Promise.all(
		jellyfinUserIds.map(async (jellyfinUserId) => {
			try {
				const raw = await integrationJson(
					integration,
					`/api/v1/user/jellyfin/${encodeURIComponent(jellyfinUserId)}`,
					{},
					fetcher
				);
				return [jellyfinUserId, SeerrUserSchema.parse(raw).id] as const;
			} catch {
				return [jellyfinUserId, undefined] as const;
			}
		})
	);
	const mappings = Object.fromEntries(entries.filter((entry) => entry[1] !== undefined)) as Record<
		string,
		number
	>;
	await store.update((config) => {
		const seerr = config.integrations.seerr;
		if (seerr) seerr.userMappings = mappings;
		return config;
	});

	return {
		mapped: Object.keys(mappings).length,
		missing: entries.filter((entry) => entry[1] === undefined).map((entry) => entry[0])
	};
}
