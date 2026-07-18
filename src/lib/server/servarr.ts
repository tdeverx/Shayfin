import { z } from 'zod';
import type { DownloadProgress, NormalizedMediaRequest } from './contracts';
import { integrationJson, type ResolvedIntegration } from './integrations';

const QueueRecordSchema = z
	.object({
		id: z.union([z.number(), z.string()]),
		title: z.string().optional(),
		size: z.number().optional(),
		sizeleft: z.number().optional(),
		sizeLeft: z.number().optional(),
		status: z.string().optional(),
		trackedDownloadStatus: z.string().optional(),
		trackedDownloadState: z.string().optional(),
		timeleft: z.string().nullish(),
		timeLeft: z.string().nullish(),
		estimatedCompletionTime: z.string().nullish(),
		errorMessage: z.string().nullish(),
		movieId: z.number().int().optional(),
		seriesId: z.number().int().optional(),
		statusMessages: z
			.array(
				z
					.object({
						title: z.string().optional(),
						messages: z.array(z.string()).optional()
					})
					.passthrough()
			)
			.optional()
	})
	.passthrough();

const MovieSchema = z
	.object({
		id: z.number().int(),
		title: z.string().optional(),
		tmdbId: z.number().int().positive().optional()
	})
	.passthrough();

const SeriesSchema = z
	.object({
		id: z.number().int(),
		title: z.string().optional(),
		tvdbId: z.number().int().positive().optional()
	})
	.passthrough();

export function normalizeDownloadState(
	record: z.infer<typeof QueueRecordSchema>
): DownloadProgress['state'] {
	const status = record.status?.toLowerCase();
	const trackedStatus = record.trackedDownloadStatus?.toLowerCase();
	const trackedState = record.trackedDownloadState?.toLowerCase();
	if (
		record.errorMessage ||
		status === 'failed' ||
		status === 'error' ||
		trackedStatus === 'error' ||
		trackedStatus === 'failed' ||
		trackedState === 'error' ||
		trackedState === 'failed' ||
		trackedState?.includes('failed')
	)
		return 'failed';
	if (trackedStatus === 'warning' || (record.statusMessages?.length ?? 0) > 0) return 'warning';
	if (trackedState?.includes('import') || status === 'importing') return 'importing';
	if (status === 'completed') return 'completed';
	if (status === 'downloading') return 'downloading';
	return 'queued';
}

function queueProgress(size: number | undefined, sizeLeft: number | undefined): number {
	if (!size || size <= 0 || sizeLeft === undefined) return 0;
	return Math.round(Math.min(100, Math.max(0, ((size - sizeLeft) / size) * 100)) * 10) / 10;
}

export function normalizeServarrQueue(
	service: 'sonarr' | 'radarr',
	records: unknown[],
	catalog: unknown[]
): DownloadProgress[] {
	const movieMap = new Map(
		catalog.flatMap((item) => {
			const parsed = MovieSchema.safeParse(item);
			return parsed.success ? [[parsed.data.id, parsed.data] as const] : [];
		})
	);
	const seriesMap = new Map(
		catalog.flatMap((item) => {
			const parsed = SeriesSchema.safeParse(item);
			return parsed.success ? [[parsed.data.id, parsed.data] as const] : [];
		})
	);

	return records.flatMap((raw) => {
		const parsed = QueueRecordSchema.safeParse(raw);
		if (!parsed.success) return [];
		const item = parsed.data;
		const movie = item.movieId === undefined ? undefined : movieMap.get(item.movieId);
		const series = item.seriesId === undefined ? undefined : seriesMap.get(item.seriesId);
		const firstMessage = item.statusMessages?.[0];
		const message = item.errorMessage ?? firstMessage?.messages?.[0] ?? firstMessage?.title;

		return [
			{
				id: `${service}:${item.id}`,
				service,
				mediaType: service === 'radarr' ? 'movie' : 'series',
				title: item.title ?? movie?.title ?? series?.title ?? 'Unknown download',
				providerIds: {
					tmdbId: movie?.tmdbId,
					tvdbId: series?.tvdbId
				},
				progress: queueProgress(item.size, item.sizeLeft ?? item.sizeleft),
				eta: item.estimatedCompletionTime ?? item.timeLeft ?? item.timeleft ?? undefined,
				state: normalizeDownloadState(item),
				message: message ?? undefined
			}
		];
	});
}

export function filterDownloadsForRequests(
	downloads: DownloadProgress[],
	requests: NormalizedMediaRequest[]
): DownloadProgress[] {
	const movies = new Set(
		requests
			.filter((request) => request.mediaType === 'movie')
			.map((request) => request.providerIds.tmdbId)
	);
	const series = new Set(
		requests
			.filter((request) => request.mediaType === 'tv')
			.flatMap((request) => (request.providerIds.tvdbId ? [request.providerIds.tvdbId] : []))
	);
	return downloads.filter((download) => {
		if (download.mediaType === 'movie') {
			return download.providerIds.tmdbId !== undefined && movies.has(download.providerIds.tmdbId);
		}
		return download.providerIds.tvdbId !== undefined && series.has(download.providerIds.tvdbId);
	});
}

export async function fetchServarrQueue(
	service: 'sonarr' | 'radarr',
	integration: ResolvedIntegration,
	fetcher: typeof fetch = fetch
): Promise<DownloadProgress[]> {
	const queueQuery =
		service === 'radarr'
			? '/api/v3/queue?page=1&pageSize=100&includeUnknownMovieItems=true&includeMovie=true'
			: '/api/v3/queue?page=1&pageSize=100&includeUnknownSeriesItems=true&includeSeries=true';
	const [queuePayload, catalogPayload] = await Promise.all([
		integrationJson(integration, queueQuery, {}, fetcher),
		integrationJson(
			integration,
			service === 'radarr' ? '/api/v3/movie' : '/api/v3/series',
			{},
			fetcher
		)
	]);
	const records = z
		.union([
			z.array(z.unknown()),
			z.object({ records: z.array(z.unknown()) }).transform((v) => v.records)
		])
		.parse(queuePayload);
	const catalog = z.array(z.unknown()).parse(catalogPayload);
	return normalizeServarrQueue(service, records, catalog);
}
