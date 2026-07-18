import { describe, expect, it } from 'vitest';
import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto.js';
import { backdropForItem, posterForItem, toMediaCard } from './media.js';

const api = {
	basePath: 'http://jellyfin.test',
	accessToken: 'token',
	deviceInfo: { id: 'device' }
} as Api;

const episode: BaseItemDto = {
	Id: 'episode-1',
	Name: 'A New Signal',
	Type: 'Episode',
	SeasonId: 'season-1',
	SeriesId: 'series-1',
	ImageTags: { Primary: 'episode-still-tag' }
};

describe('episode artwork roles', () => {
	it('uses the season primary image as an episode poster', () => {
		const url = new URL(posterForItem(api, episode, 480)!);

		expect(url.pathname).toBe('/Items/season-1/Images/Primary');
		expect(url.searchParams.get('maxWidth')).toBe('480');
	});

	it('uses the episode still as its backdrop and landscape card image', () => {
		const backdrop = new URL(backdropForItem(api, episode, 1280)!);
		const landscape = new URL(toMediaCard(api, episode, 'landscape')!.imageUrl!);

		expect(backdrop.pathname).toBe('/Items/episode-1/Images/Primary');
		expect(backdrop.searchParams.get('tag')).toBe('episode-still-tag');
		expect(landscape.pathname).toBe('/Items/episode-1/Images/Primary');
	});

	it('keeps the season image on portrait episode cards', () => {
		const portrait = new URL(toMediaCard(api, episode, 'portrait')!.imageUrl!);

		expect(portrait.pathname).toBe('/Items/season-1/Images/Primary');
	});
});
