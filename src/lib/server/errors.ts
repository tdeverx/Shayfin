import { json } from '@sveltejs/kit';
import { z } from 'zod';

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export function errorResponse(error: unknown): Response {
	if (error instanceof ApiError) {
		return json(
			{ error: { code: error.code, message: error.message, details: error.details } },
			{ status: error.status }
		);
	}

	if (error instanceof z.ZodError) {
		return json(
			{
				error: {
					code: 'invalid_request',
					message: 'The request payload is invalid.',
					details: z.flattenError(error).fieldErrors
				}
			},
			{ status: 400 }
		);
	}

	console.error('[shayfin] Unexpected API error', error);
	return json(
		{ error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
		{ status: 500 }
	);
}

export async function parseJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ApiError(400, 'invalid_json', 'The request body must contain valid JSON.');
	}
}
