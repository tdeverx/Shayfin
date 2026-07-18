import { APP_VERSION } from '$lib/server/version';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ status: 'ok', version: APP_VERSION, timestamp: new Date().toISOString() });
};
