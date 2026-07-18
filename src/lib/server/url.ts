import { z } from 'zod';

const HttpUrlSchema = z.url().refine((value) => {
	const url = new URL(value);
	return (
		(url.protocol === 'http:' || url.protocol === 'https:') &&
		url.username.length === 0 &&
		url.password.length === 0
	);
}, 'URL must use http or https and cannot contain credentials');

export function normalizeServiceUrl(value: string): string {
	const trimmed = value.trim();
	const parsed = HttpUrlSchema.parse(trimmed);
	const url = new URL(parsed);

	url.hash = '';
	url.search = '';
	url.pathname = url.pathname.replace(/\/+$/, '');

	return url.toString().replace(/\/$/, '');
}

export function joinServiceUrl(baseUrl: string, path: string): string {
	const base = `${normalizeServiceUrl(baseUrl)}/`;
	return new URL(path.replace(/^\/+/, ''), base).toString();
}
