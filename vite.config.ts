import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'base-uri': ['self'],
					'object-src': ['none'],
					'frame-ancestors': ['none'],
					'form-action': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self', 'data:'],
					'img-src': ['self', 'data:', 'blob:', 'http:', 'https:'],
					'media-src': ['self', 'blob:', 'http:', 'https:'],
					'connect-src': ['self', 'http:', 'https:', 'ws:', 'wss:'],
					'worker-src': ['self', 'blob:'],
					'frame-src': ['self']
				}
			},
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
