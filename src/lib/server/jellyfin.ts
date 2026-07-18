import { z } from 'zod';
import type { JellyfinServerIdentity } from './contracts';
import { ApiError } from './errors';
import { joinServiceUrl } from './url';

const JellyfinUserSchema = z.object({
	Id: z.string().min(1),
	Name: z.string().min(1),
	Policy: z
		.object({
			IsAdministrator: z.boolean().default(false)
		})
		.default({ IsAdministrator: false })
});

const JellyfinServerSchema = z.object({
	Id: z.string().min(1),
	ServerName: z.string().min(1),
	Version: z.string().optional()
});

export type JellyfinUser = z.infer<typeof JellyfinUserSchema>;

function jellyfinHeaders(token: string): HeadersInit {
	return {
		Accept: 'application/json',
		'X-Emby-Token': token,
		Authorization: `MediaBrowser Token="${token.replace(/["\\]/g, '')}"`
	};
}

async function jellyfinJson(
	baseUrl: string,
	path: string,
	token: string,
	fetcher: typeof fetch
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetcher(joinServiceUrl(baseUrl, path), {
			headers: jellyfinHeaders(token),
			redirect: 'manual',
			signal: AbortSignal.timeout(8_000)
		});
	} catch {
		throw new ApiError(502, 'jellyfin_unreachable', 'Jellyfin could not be reached.');
	}

	if (response.status === 401 || response.status === 403) {
		throw new ApiError(401, 'invalid_jellyfin_token', 'The Jellyfin access token is invalid.');
	}
	if (!response.ok) {
		throw new ApiError(
			502,
			'jellyfin_error',
			`Jellyfin returned an unexpected ${response.status} response.`
		);
	}

	return response.json();
}

export async function getJellyfinMe(
	baseUrl: string,
	token: string,
	fetcher: typeof fetch = fetch
): Promise<JellyfinUser> {
	return JellyfinUserSchema.parse(await jellyfinJson(baseUrl, '/Users/Me', token, fetcher));
}

export async function getJellyfinServerIdentity(
	baseUrl: string,
	token: string,
	fetcher: typeof fetch = fetch
): Promise<JellyfinServerIdentity> {
	const parsed = JellyfinServerSchema.parse(
		await jellyfinJson(baseUrl, '/System/Info/Public', token, fetcher)
	);
	return { id: parsed.Id, name: parsed.ServerName, version: parsed.Version };
}

export async function getJellyfinUsers(
	baseUrl: string,
	token: string,
	fetcher: typeof fetch = fetch
): Promise<JellyfinUser[]> {
	return z.array(JellyfinUserSchema).parse(await jellyfinJson(baseUrl, '/Users', token, fetcher));
}

export async function probeJellyfin(
	baseUrl: string,
	fetcher: typeof fetch = fetch
): Promise<JellyfinServerIdentity> {
	try {
		const response = await fetcher(joinServiceUrl(baseUrl, '/System/Info/Public'), {
			headers: { Accept: 'application/json' },
			redirect: 'manual',
			signal: AbortSignal.timeout(5_000)
		});
		if (!response.ok) throw new Error('non-success response');
		const parsed = JellyfinServerSchema.parse(await response.json());
		return { id: parsed.Id, name: parsed.ServerName, version: parsed.Version };
	} catch {
		throw new ApiError(503, 'jellyfin_unready', 'The configured Jellyfin server is unavailable.');
	}
}

export async function validateJellyfinEndpoints(
	publicUrl: string,
	internalUrl: string | undefined,
	token: string,
	fetcher: typeof fetch = fetch
): Promise<JellyfinServerIdentity> {
	const validationUrl = internalUrl ?? publicUrl;
	const [validated, publicIdentity] = await Promise.all([
		getJellyfinServerIdentity(validationUrl, token, fetcher),
		internalUrl ? getJellyfinServerIdentity(publicUrl, token, fetcher) : Promise.resolve(undefined)
	]);

	if (publicIdentity && publicIdentity.id !== validated.id) {
		throw new ApiError(
			400,
			'jellyfin_identity_mismatch',
			'The public and internal URLs must point to the same Jellyfin server.'
		);
	}

	return validated;
}
