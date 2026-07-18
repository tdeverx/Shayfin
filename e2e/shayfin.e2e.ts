import { expect, test } from '@playwright/test';
import { mockAuthenticatedApp, mockBootstrap } from './fixtures';

test.describe('first-run and login', () => {
	test('renders the guided first-run setup without requiring a live server', async ({ page }) => {
		await mockBootstrap(page, false);
		await page.goto('/setup');

		await expect(page).toHaveTitle(/Shayfin/);
		await expect(page.getByText('Connect Jellyfin', { exact: true })).toBeVisible();
		await expect(page.getByText(/verify a Jellyfin administrator to finish setup/)).toBeVisible();
		await expect(page.getByLabel('Public Jellyfin URL')).toHaveValue('http://localhost:8096');
		await expect(page.getByLabel(/Internal Jellyfin URL/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Connect server' })).toBeDisabled();
		await expect(page.getByText('Your password is sent directly to Jellyfin.')).toBeVisible();
	});

	test('shows the configured Jellyfin identity on login', async ({ page }) => {
		await mockBootstrap(page, true);
		await page.goto('/login');

		await expect(page.getByText('Sign in to Jellyfin', { exact: true })).toBeVisible();
		await expect(page.getByText(/same account you already use on Living Room/)).toBeVisible();
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
	});
});

test.describe('authenticated media shell', () => {
	test('shows only supported accessible media in the non-admin pill', async ({ page }) => {
		await mockAuthenticatedApp(page, { admin: false, movies: true, series: true });
		await page.goto('/home');

		const media = page.getByRole('navigation', { name: 'Media' });
		await expect(media).toBeVisible();
		await expect(media.getByRole('radio', { name: 'Home' })).toBeVisible();
		await expect(media.getByRole('radio', { name: 'Movies' })).toBeVisible();
		await expect(media.getByRole('radio', { name: 'Series' })).toBeVisible();
		await expect(media.getByRole('radio', { name: 'Music' })).toHaveCount(0);
		await expect(page.locator('[data-slot="sidebar-wrapper"]')).toHaveCount(0);
		await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
	});

	test('adds the admin navigation only for Jellyfin administrators', async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1000 });
		await mockAuthenticatedApp(page, { admin: true });
		await page.goto('/home');

		await expect(page.locator('[data-slot="sidebar-wrapper"]')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Connections' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Integrations' })).toBeVisible();
		await expect(page.getByText('Jellyfin connected')).toBeVisible();
		await expect(page.getByText('Server 10.11.11')).toBeVisible();
		const sidebarToggle = page.getByRole('button', { name: 'Toggle admin sidebar' });
		await expect(sidebarToggle).toBeVisible();
		await sidebarToggle.click();
		await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute(
			'data-state',
			'collapsed'
		);
		await sidebarToggle.click();
		await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute(
			'data-state',
			'expanded'
		);
	});

	test('falls back to the restrained Jellyfin home when Home Screen Sections is absent', async ({
		page
	}) => {
		await mockAuthenticatedApp(page);
		await page.goto('/home');

		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible();
		await expect(page.getByText('The Arrival')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Next up' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Recently added' })).toBeVisible();
		await expect(page.getByText('Signal Fire')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
	});

	test('uses the whole first editorial row as the hero and skips continue watching', async ({
		page
	}) => {
		await mockAuthenticatedApp(page, { homeSectionsAvailable: true });
		await page.goto('/home');

		await expect(page.getByRole('heading', { name: 'Signal Fire' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Continue Watching / Next Up' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Staff Picks' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Next featured item' }).click();
		await expect(page.getByRole('heading', { name: 'Quiet Harbor' })).toBeVisible();
	});

	test('browses and filters the shared movie library', async ({ page }) => {
		await mockAuthenticatedApp(page);
		await page.goto('/movies');

		await expect(page.getByRole('heading', { name: 'Movies' })).toBeVisible();
		await expect(page.getByText('Nebula Run', { exact: true })).toBeVisible();
		await expect(page.getByText('1 titles')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sort movies' })).toContainText('Title');

		await page.getByRole('textbox', { name: 'Search movies' }).fill('missing');
		await expect(page.getByText('No matching movies')).toBeVisible();
		await page.getByRole('button', { name: 'Clear filters' }).click();
		await expect(page.getByText('Nebula Run', { exact: true })).toBeVisible();
	});

	test('browses the shared series library with series-specific labels', async ({ page }) => {
		await mockAuthenticatedApp(page);
		await page.goto('/series');

		await expect(page.getByRole('heading', { name: 'Series' })).toBeVisible();
		await expect(page.getByText('Signal House', { exact: true })).toBeVisible();
		await expect(page.getByText('1 series')).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Search series' })).toHaveAttribute(
			'placeholder',
			'Search series or genres'
		);
		await page.getByRole('button', { name: 'Sort series' }).click();
		await expect(page.getByRole('option', { name: 'First aired' })).toBeVisible();
	});

	test('preserves local Cmd/Ctrl+K search when Seerr is unavailable', async ({ page }) => {
		await mockAuthenticatedApp(page, { seerrUnavailable: true });
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();

		await page.keyboard.press('Control+K');
		const search = page.getByRole('dialog', { name: 'Search Shayfin' });
		await expect(search).toBeVisible();
		await search.getByPlaceholder('Search movies and series…').fill('signal');

		await expect(search.getByText('In your library')).toBeVisible();
		await expect(search.getByText('Signal Fire')).toBeVisible();
		await expect(search.getByText('Discover & request')).toHaveCount(0);

		await search.getByPlaceholder('Search movies and series…').press('Enter');
		await expect(page).toHaveURL(/\/item\/movie-latest$/);
	});

	test('prioritizes local search, deduplicates Seerr, and keeps keyboard selection local', async ({
		page
	}) => {
		await mockAuthenticatedApp(page, {
			seerrResults: [
				{
					id: 'movie:1002',
					mediaType: 'movie',
					title: 'Signal Fire',
					providerIds: { tmdbId: 1002 },
					availability: 'available'
				},
				{
					id: 'movie:3001',
					mediaType: 'movie',
					title: 'Signal Horizon',
					providerIds: { tmdbId: 3001 }
				}
			]
		});
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();

		await page.keyboard.press('Control+K');
		const search = page.getByRole('dialog', { name: 'Search Shayfin' });
		const input = search.getByPlaceholder('Search movies and series…');
		await input.fill('signal');

		await expect(search.getByText('In your library')).toBeVisible();
		await expect(search.getByText('Discover & request')).toBeVisible();
		await expect(search.getByText('Signal Fire', { exact: true })).toHaveCount(1);
		await expect(search.getByText('Signal Horizon', { exact: true })).toBeVisible();

		await input.press('Enter');
		await expect(page).toHaveURL(/\/item\/movie-latest$/);
	});

	test('submits a movie request with the selected 4K preference', async ({ page }) => {
		const requestBodies: Record<string, unknown>[] = [];
		await mockAuthenticatedApp(page, {
			seerrResults: [
				{
					id: 'movie:3002',
					mediaType: 'movie',
					title: 'Frontier Echo',
					providerIds: { tmdbId: 3002 }
				}
			],
			requestBodies
		});
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();

		await page.keyboard.press('Control+K');
		const search = page.getByRole('dialog', { name: 'Search Shayfin' });
		await search.getByPlaceholder('Search movies and series…').fill('frontier');
		await search.getByText('Frontier Echo', { exact: true }).click();

		const request = page.getByRole('dialog', { name: 'Request Frontier Echo' });
		await expect(request).toBeVisible();
		await request.getByRole('switch', { name: 'Prefer 4K' }).click();
		await request.getByRole('button', { name: 'Send request' }).click();

		await expect(page.getByText('Frontier Echo was requested.')).toBeVisible();
		expect(requestBodies).toEqual([{ mediaType: 'movie', mediaId: 3002, is4k: true }]);
	});

	test('submits selected TV seasons and keeps a rejected request dialog open', async ({ page }) => {
		const requestBodies: Record<string, unknown>[] = [];
		await mockAuthenticatedApp(page, {
			seerrResults: [
				{
					id: 'tv:4001',
					mediaType: 'tv',
					title: 'Signal House Reborn',
					providerIds: { tmdbId: 4001 }
				}
			],
			requestBodies,
			requestOutcome: {
				status: 409,
				body: { message: 'This series is already requested.' }
			}
		});
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();

		await page.keyboard.press('Control+K');
		const search = page.getByRole('dialog', { name: 'Search Shayfin' });
		await search.getByPlaceholder('Search movies and series…').fill('reborn');
		await search.getByText('Signal House Reborn', { exact: true }).click();

		const request = page.getByRole('dialog', { name: 'Request Signal House Reborn' });
		await request.getByRole('switch', { name: 'All available seasons' }).click();
		await request.getByLabel('Season numbers').fill('1, 3');
		await request.getByRole('button', { name: 'Send request' }).click();

		await expect(request.getByRole('alert')).toHaveText('This series is already requested.');
		await expect(request).toBeVisible();
		expect(requestBodies).toEqual([
			{ mediaType: 'tv', mediaId: 4001, seasons: [1, 3], is4k: false }
		]);
	});
});

test.describe('profile capabilities', () => {
	test('keeps core activity and avatar fallbacks when optional services are unavailable', async ({
		page
	}) => {
		await mockAuthenticatedApp(page, {
			userImage: true,
			profileRequests: null,
			achievementsAvailable: false,
			getAvatarAvailable: false
		});
		await page.goto('/profile');

		await expect(page.getByRole('heading', { name: 'Nora Viewer' })).toBeVisible();
		await expect(page.locator(`img[src*="/Users/user-1/Images/Primary"]`).last()).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Recently played' })).toBeVisible();
		await expect(page.getByText('Nebula Run')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Requests' })).toHaveCount(0);
		await expect(page.getByRole('tab', { name: 'Achievements' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Choose avatar' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Achievement summary' })).toHaveCount(0);

		await page.getByRole('tab', { name: 'Favorites' }).click();
		await expect(page.getByText('Quiet Harbor')).toBeVisible();
	});

	test('renders achievement, request, and GetAvatar surfaces when capabilities are available', async ({
		page
	}) => {
		const avatarSetBodies: Record<string, unknown>[] = [];
		await mockAuthenticatedApp(page, {
			achievementsAvailable: true,
			getAvatarAvailable: true,
			avatarSetBodies,
			profileRequests: [
				{
					id: 71,
					mediaType: 'tv',
					providerIds: { tmdbId: 444, tvdbId: 555 },
					status: 'approved',
					is4k: false,
					seasons: [1, 2],
					createdAt: '2026-07-02T12:00:00Z'
				}
			]
		});
		await page.goto('/profile');

		await expect(page.getByRole('heading', { name: 'Achievement summary' })).toBeVisible();
		await expect(page.getByText('12 / 24', { exact: true })).toBeVisible();
		await expect(page.getByText('Hours watched')).toBeVisible();
		await expect(page.getByText('128', { exact: true })).toBeVisible();

		await page.getByRole('tab', { name: 'Requests' }).click();
		await expect(page.getByText('Series · TMDB 444')).toBeVisible();
		await expect(page.getByText('Seasons 1, 2')).toBeVisible();

		await page.getByRole('tab', { name: 'Achievements' }).click();
		await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible();
		await expect(page.getByText('Movie Night')).toBeVisible();
		await expect(page.getByText('4 of 10')).toBeVisible();
		await expect(page.getByText('First Flight').first()).toBeVisible();
		await expect(page.getByText('Rare').first()).toBeVisible();

		await page.getByRole('button', { name: 'Choose avatar' }).click();
		const avatarDialog = page.getByRole('dialog', { name: 'Choose an avatar' });
		await avatarDialog.getByRole('button', { name: 'Orbit' }).click();
		await expect(page.getByText('Avatar updated.')).toBeVisible();
		expect(avatarSetBodies).toEqual([{ AvatarId: 'avatar-1', UserId: 'user-1' }]);
	});
});

test.describe('download visibility and masked administration', () => {
	test('renders only the non-admin download response with a bearer session', async ({ page }) => {
		const authorizations: (string | null)[] = [];
		await mockAuthenticatedApp(page, {
			downloadAuthorizations: authorizations,
			downloads: [
				{
					id: 'owned-download',
					service: 'radarr',
					mediaType: 'movie',
					title: 'Owned Adventure',
					providerIds: { tmdbId: 3002 },
					progress: 64,
					state: 'downloading'
				}
			]
		});
		await page.goto('/home');

		await expect(page.getByRole('heading', { name: 'On the way' })).toBeVisible();
		await expect(page.getByText('Owned Adventure')).toBeVisible();
		await expect(page.getByText('Administrator Queue Only')).toHaveCount(0);
		await expect.poll(() => authorizations[0]).toBe('Bearer shayfin-e2e-token');
	});

	test('renders the complete administrator queue response', async ({ page }) => {
		await mockAuthenticatedApp(page, {
			admin: true,
			downloads: [
				{
					id: 'owned-download',
					service: 'radarr',
					mediaType: 'movie',
					title: 'Owned Adventure',
					providerIds: { tmdbId: 3002 },
					progress: 64,
					state: 'downloading'
				},
				{
					id: 'admin-download',
					service: 'sonarr',
					mediaType: 'series',
					title: 'Administrator Queue Only',
					providerIds: { tvdbId: 8001 },
					progress: 18,
					state: 'queued'
				}
			]
		});
		await page.goto('/admin/downloads');

		await expect(page.getByRole('heading', { name: 'Downloads' })).toBeVisible();
		await expect(page.getByText('Owned Adventure').first()).toBeVisible();
		await expect(page.getByText('Administrator Queue Only').first()).toBeVisible();
	});

	test('renders masked integration state without exposing an API key to the browser UI', async ({
		page
	}) => {
		await mockAuthenticatedApp(page, {
			admin: true,
			adminSettings: {
				jellyfin: {
					publicUrl: 'https://media.example.test/jellyfin',
					internalUrl: 'http://jellyfin:8096',
					serverId: 'server-1',
					serverName: 'Living Room',
					serverVersion: '10.11.11'
				},
				integrations: {
					seerr: {
						enabled: true,
						url: 'http://seerr:5055',
						apiKeyConfigured: true,
						mappedUsers: 3
					},
					sonarr: { enabled: false, url: '', apiKeyConfigured: false },
					radarr: { enabled: false, url: '', apiKeyConfigured: false }
				}
			}
		});
		const settingsResponse = page.waitForResponse((response) =>
			response.url().endsWith('/api/admin/settings')
		);
		await page.goto('/admin/integrations');
		const payload = (await (await settingsResponse).json()) as {
			integrations: Record<string, Record<string, unknown>>;
		};

		expect(payload.integrations.seerr).not.toHaveProperty('apiKey');
		await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
		await expect(page.getByText('Key stored')).toBeVisible();
		await expect(page.getByLabel('Service URL').first()).toHaveValue('http://seerr:5055');
		await expect(page.getByLabel('API key').first()).toHaveValue('');
		await expect(page.getByLabel('API key').first()).toHaveAttribute(
			'placeholder',
			'Stored securely — enter a replacement only'
		);
	});
});

test('follows the browser system light and dark color scheme', async ({ page }) => {
	await mockBootstrap(page, false);
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/setup');

	const dark = await page.evaluate(() => ({
		background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
		scheme: getComputedStyle(document.documentElement).colorScheme
	}));
	expect(dark.scheme).toBe('dark');

	await page.emulateMedia({ colorScheme: 'light' });
	await expect
		.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
		.toBe('light');
	const lightBackground = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
	);
	expect(lightBackground).not.toBe(dark.background);
});

test.describe('mobile shell', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the media pill and profile menu usable without overlap', async ({ page }) => {
		await mockAuthenticatedApp(page, { admin: false, userName: 'Nora Viewer' });
		await page.goto('/home');
		await expect(page.getByRole('heading', { name: 'Nebula Run' })).toBeVisible();

		const media = page.getByRole('navigation', { name: 'Media' });
		const profile = page.getByRole('button', { name: "Open Nora Viewer's profile menu" });
		await expect(media).toBeVisible();
		await expect(media.getByRole('radio', { name: 'Home' })).toBeVisible();
		await expect(media.getByRole('button', { name: 'Search' })).toBeVisible();
		await expect(profile).toBeVisible();
		await expect(media.getByText('Home')).toBeHidden();

		const [mediaBox, profileBox] = await Promise.all([media.boundingBox(), profile.boundingBox()]);
		expect(mediaBox).not.toBeNull();
		expect(profileBox).not.toBeNull();
		expect(mediaBox!.x).toBeGreaterThanOrEqual(0);
		expect(mediaBox!.x + mediaBox!.width).toBeLessThanOrEqual(profileBox!.x);

		await profile.click();
		await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();
		await expect(page.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0);
	});
});
