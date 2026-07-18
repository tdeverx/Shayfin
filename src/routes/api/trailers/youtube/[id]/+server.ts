import type { RequestHandler } from './$types';
import { authenticateRequest } from '$lib/server/auth';
import { ApiError, errorResponse } from '$lib/server/errors';
import { youtubeTrailerStream } from '$lib/server/youtube';

export const GET: RequestHandler = async ({ params, request, url }) => {
	try {
		const token = url.searchParams.get('token');
		if (!token) {
			throw new ApiError(401, 'missing_token', 'A Jellyfin session is required.');
		}
		const headers = new Headers(request.headers);
		headers.set('authorization', `Bearer ${token}`);
		await authenticateRequest(new Request(request.url, { method: 'GET', headers }));

		const trailer = await youtubeTrailerStream(params.id, request.headers.get('range'));
		const responseHeaders = new Headers({
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'private, max-age=1800',
			'Content-Type': trailer.contentType,
			'X-Content-Type-Options': 'nosniff'
		});
		if (trailer.range && trailer.contentLength) {
			responseHeaders.set(
				'Content-Range',
				`bytes ${trailer.range.start}-${trailer.range.end}/${trailer.contentLength}`
			);
			responseHeaders.set('Content-Length', String(trailer.range.end - trailer.range.start + 1));
		} else if (trailer.contentLength) {
			responseHeaders.set('Content-Length', String(trailer.contentLength));
		}

		return new Response(trailer.body, {
			status: trailer.range ? 206 : 200,
			headers: responseHeaders
		});
	} catch (error) {
		return errorResponse(error);
	}
};
