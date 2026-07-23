import type { Page, Route } from '@playwright/test';

export const SERVER_ID = 'shayfin-e2e-server';
export const ACCESS_TOKEN = 'shayfin-e2e-token';
export const USER_ID = 'user-1';

export interface MockSearchResult {
	id: string;
	mediaType: 'movie' | 'tv';
	title: string;
	providerIds: { tmdbId: number; tvdbId?: number };
	availability?: 'unknown' | 'pending' | 'processing' | 'partial' | 'available';
	requestStatus?: 'pending' | 'approved' | 'declined' | 'failed' | 'completed';
	requested?: boolean;
}

export interface MockDownload {
	id: string;
	service: 'sonarr' | 'radarr';
	instanceId?: string;
	instanceLabel?: string;
	mediaType: 'series' | 'movie';
	title: string;
	providerIds: { tmdbId?: number; tvdbId?: number };
	progress: number;
	eta?: string;
	state: 'queued' | 'downloading' | 'importing' | 'completed' | 'warning' | 'failed';
	message?: string;
}

export interface MockRequestOutcome {
	status: number;
	body: unknown;
}

export interface AuthenticatedMockOptions {
	admin?: boolean;
	movies?: boolean;
	series?: boolean;
	userName?: string;
	userImage?: boolean;
	seerrUnavailable?: boolean;
	seerrResults?: MockSearchResult[];
	requestBodies?: Record<string, unknown>[];
	requestOutcome?: MockRequestOutcome | ((body: Record<string, unknown>) => MockRequestOutcome);
	profileRequests?: Record<string, unknown>[] | null;
	achievementsAvailable?: boolean;
	getAvatarAvailable?: boolean;
	homeSectionsAvailable?: boolean;
	avatarSetBodies?: Record<string, unknown>[];
	downloads?: MockDownload[];
	downloadAuthorizations?: (string | null)[];
	adminSettings?: Record<string, unknown>;
}

const featuredMovie = {
	Id: 'movie-featured',
	Name: 'Nebula Run',
	Type: 'Movie',
	ProductionYear: 2025,
	OfficialRating: 'PG-13',
	RunTimeTicks: 7_200_000_000,
	Taglines: ['Beyond the mapped edge.'],
	Overview: 'A salvage crew follows a quiet signal beyond the mapped edge of space.',
	BackdropImageTags: ['featured-backdrop'],
	ProviderIds: { Tmdb: '1001' }
};

const featuredSeries = {
	Id: 'series-featured',
	Name: 'Signal House',
	Type: 'Series',
	ProductionYear: 2023,
	OfficialRating: 'TV-14',
	Overview: 'A remote listening station hears a transmission that should not exist.',
	ProviderIds: { Tmdb: '4001' }
};

const resumeEpisode = {
	Id: 'episode-resume',
	Name: 'The Arrival',
	Type: 'Episode',
	SeriesName: 'Signal House',
	ParentIndexNumber: 1,
	IndexNumber: 3,
	RunTimeTicks: 3_000_000_000,
	UserData: { PlaybackPositionTicks: 1_500_000_000 },
	ProviderIds: { Tmdb: '2001' }
};

const nextEpisode = {
	Id: 'episode-next',
	Name: 'Open Circuit',
	Type: 'Episode',
	SeriesName: 'Signal House',
	ParentIndexNumber: 1,
	IndexNumber: 4,
	ProviderIds: { Tmdb: '2002' }
};

const latestMovie = {
	Id: 'movie-latest',
	Name: 'Signal Fire',
	Type: 'Movie',
	ProductionYear: 2024,
	ProviderIds: { Tmdb: '1002' }
};

const favoriteMovie = {
	Id: 'movie-favorite',
	Name: 'Quiet Harbor',
	Type: 'Movie',
	ProductionYear: 2022,
	ProviderIds: { Tmdb: '1003' },
	UserData: { IsFavorite: true }
};

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		headers: { 'access-control-allow-origin': '*' },
		body: JSON.stringify(body)
	});
}

export async function mockBootstrap(page: Page, configured: boolean) {
	await page.route('**/api/bootstrap', (route) =>
		json(
			route,
			configured
				? {
						configured: true,
						version: '0.0.1-e2e',
						jellyfin: {
							publicUrl: 'http://127.0.0.1:4173/jellyfin',
							server: { id: SERVER_ID, name: 'Living Room', version: '10.11.11' }
						},
						plugins: {
							homeScreenSections: { enabled: true },
							mediaBarEnhanced: { enabled: true },
							achievementBadges: { enabled: true, unlockNotifications: true },
							getAvatar: { enabled: true }
						}
					}
				: { configured: false, version: '0.0.1-e2e' }
		)
	);
}

async function installBrowserSession(page: Page) {
	await page.addInitScript(
		({ serverId, token }) => {
			localStorage.setItem(`shayfin:${serverId}:access-token`, token);
			localStorage.setItem('shayfin:device-id', 'shayfin-e2e-device');

			class QuietWebSocket {
				static readonly OPEN = 1;
				readonly readyState = 0;
				addEventListener() {}
				removeEventListener() {}
				send() {}
				close() {}
			}

			Object.defineProperty(window, 'WebSocket', {
				configurable: true,
				value: QuietWebSocket
			});
		},
		{ serverId: SERVER_ID, token: ACCESS_TOKEN }
	);
}

function lowerCaseSearch(url: URL): Map<string, string> {
	return new Map(
		Array.from(url.searchParams.entries(), ([key, value]) => [key.toLowerCase(), value])
	);
}

export async function mockAuthenticatedApp(
	page: Page,
	{
		admin = false,
		movies = true,
		series = true,
		userName = admin ? 'Avery Admin' : 'Nora Viewer',
		userImage = false,
		seerrUnavailable = false,
		seerrResults = [],
		requestBodies,
		requestOutcome = { status: 201, body: { id: 901, status: 'pending' } },
		profileRequests = null,
		achievementsAvailable = false,
		getAvatarAvailable = false,
		homeSectionsAvailable = false,
		avatarSetBodies,
		downloads = [],
		downloadAuthorizations,
		adminSettings
	}: AuthenticatedMockOptions = {}
) {
	await mockBootstrap(page, true);
	await installBrowserSession(page);

	await page.route('**/api/external/downloads', (route) => {
		downloadAuthorizations?.push(route.request().headers().authorization ?? null);
		return json(route, {
			downloads,
			capabilities: [
				{ service: 'seerr', status: 'available' },
				{
					service: 'sonarr',
					instanceId: 'sonarr-main',
					instanceLabel: 'Sonarr main',
					status: 'available'
				},
				{
					service: 'radarr',
					instanceId: 'radarr-main',
					instanceLabel: 'Radarr main',
					status: 'available'
				}
			]
		});
	});
	await page.route('**/api/external/search**', (route) =>
		seerrUnavailable
			? json(route, { error: 'Seerr is not configured' }, 503)
			: json(route, {
					results: seerrResults.map((result) => ({
						source: 'seerr',
						availability: 'unknown',
						requested: false,
						...result
					}))
				})
	);
	await page.route('**/api/external/requests**', async (route) => {
		if (route.request().method() === 'GET') {
			return profileRequests === null
				? json(route, { error: 'Seerr is not configured' }, 503)
				: json(route, { results: profileRequests });
		}

		const body = route.request().postDataJSON() as Record<string, unknown>;
		requestBodies?.push(body);
		const outcome = typeof requestOutcome === 'function' ? requestOutcome(body) : requestOutcome;
		return json(route, outcome.body, outcome.status);
	});

	const maskedSettings =
		adminSettings ??
		({
			jellyfin: {
				publicUrl: 'http://127.0.0.1:4173/jellyfin',
				internalUrl: 'http://jellyfin:8096',
				serverId: SERVER_ID,
				serverName: 'Living Room',
				serverVersion: '10.11.11'
			},
			integrations: {
				seerr: { enabled: false, url: '', apiKeyConfigured: false, mappedUsers: 0 },
				sonarr: [],
				radarr: []
			},
			plugins: {
				homeScreenSections: { enabled: true },
				mediaBarEnhanced: { enabled: true },
				achievementBadges: { enabled: true, unlockNotifications: true },
				getAvatar: { enabled: true }
			}
		} satisfies Record<string, unknown>);
	await page.route('**/api/admin/settings', (route) => json(route, maskedSettings));
	await page.route('**/api/admin/seerr', (route) =>
		json(route, (maskedSettings as { integrations: { seerr: unknown } }).integrations.seerr)
	);
	await page.route('**/api/admin/servarr/sonarr', (route) =>
		json(route, (maskedSettings as { integrations: { sonarr: unknown } }).integrations.sonarr)
	);
	await page.route('**/api/admin/servarr/radarr', (route) =>
		json(route, (maskedSettings as { integrations: { radarr: unknown } }).integrations.radarr)
	);

	await page.route('**/jellyfin/**', async (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') {
			await route.fulfill({
				status: 204,
				headers: {
					'access-control-allow-origin': '*',
					'access-control-allow-headers': '*',
					'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'
				}
			});
			return;
		}

		const url = new URL(request.url());
		const path = url.pathname.replace(/^\/jellyfin/, '');
		const query = lowerCaseSearch(url);

		if (path === '/Users/Me') {
			await json(route, {
				Id: USER_ID,
				Name: userName,
				...(userImage ? { PrimaryImageTag: 'user-image-tag' } : {}),
				Policy: { IsAdministrator: admin }
			});
			return;
		}

		if (path === `/Users/${USER_ID}/Images/Primary`) {
			await route.fulfill({
				status: 200,
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />'
			});
			return;
		}

		if (/^\/Items\/[^/]+\/Images\//.test(path)) {
			await route.fulfill({
				status: 200,
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#333"/></svg>'
			});
			return;
		}

		if (path === '/UserViews' && query.get('userid') === USER_ID) {
			const Items = [
				...(movies ? [{ Id: 'view-movies', Name: 'Movies', CollectionType: 'movies' }] : []),
				...(series ? [{ Id: 'view-series', Name: 'Series', CollectionType: 'tvshows' }] : []),
				{ Id: 'view-music', Name: 'Music', CollectionType: 'music' }
			];
			await json(route, { Items, TotalRecordCount: Items.length });
			return;
		}

		if (path === '/HomeScreen/Sections') {
			if (homeSectionsAvailable) {
				await json(route, {
					Items: [
						{
							Section: 'continue',
							DisplayText: 'Continue Watching / Next Up',
							ViewMode: 'landscape',
							OrderIndex: 0
						},
						{
							Section: 'editorial',
							DisplayText: 'Staff Picks',
							ViewMode: 'landscape',
							OrderIndex: 1
						}
					]
				});
				return;
			}
			await json(route, { error: 'Plugin not installed' }, 404);
			return;
		}

		if (path === '/HomeScreen/Section/continue' && homeSectionsAvailable) {
			await json(route, { Items: [resumeEpisode, nextEpisode] });
			return;
		}

		if (path === '/HomeScreen/Section/editorial' && homeSectionsAvailable) {
			await json(route, { Items: [latestMovie, favoriteMovie] });
			return;
		}

		if (path.startsWith('/Plugins/AchievementBadges/')) {
			if (!achievementsAvailable) {
				await json(route, { error: 'Plugin not installed' }, 404);
				return;
			}

			if (path.endsWith('/summary')) {
				await json(route, {
					Unlocked: 12,
					Total: 24,
					Percentage: 50,
					EquippedCount: 1,
					Score: 1250,
					CurrentWatchStreak: 4,
					BestWatchStreak: 9
				});
				return;
			}

			if (path.endsWith('/records')) {
				await json(route, {
					MoviesWatched: 42,
					SeriesCompleted: 7,
					TotalHoursWatched: 128,
					TotalItemsWatched: 233
				});
				return;
			}
			if (path.endsWith('/rank')) {
				await json(route, {
					Score: 1250,
					Tier: { Name: 'Viewer', MinScore: 1000 },
					NextTier: { Name: 'Regular', MinScore: 2000 },
					ProgressToNext: 25,
					Tiers: []
				});
				return;
			}
			if (path.endsWith('/bank')) {
				await json(route, {
					ScoreBank: 300,
					LifetimeScore: 1450,
					PrestigeLevel: 1,
					ComboCount: 2,
					BestComboCount: 5
				});
				return;
			}
			if (path.endsWith('/quests')) {
				await json(route, {
					Daily: [
						{
							Id: 'daily-1',
							Title: 'Evening feature',
							Description: 'Finish one movie.',
							Current: 0,
							Target: 1,
							Reward: 25
						}
					],
					Weekly: []
				});
				return;
			}
			if (path.endsWith('/watch-calendar')) {
				await json(route, { Days: 90, Counts: { '2026-07-01': 2, '2026-07-02': 1 } });
				return;
			}
			if (path.endsWith('/library-completion')) {
				await json(route, { LibraryCompletionPercents: { Movies: 35 } });
				return;
			}
			if (path.endsWith('/category-progress')) {
				await json(route, [{ Category: 'Movies', Total: 2, Unlocked: 1, Percent: 50 }]);
				return;
			}
			if (path.endsWith('/recap')) {
				await json(route, { ItemsWatched: 8, MinutesWatched: 640 });
				return;
			}
			if (path === '/Plugins/AchievementBadges/badges/rarity-stats') {
				await json(route, { 'first-flight': 42.5, 'movie-night': 18 });
				return;
			}

			const badge = {
				Id: 'first-flight',
				Key: 'first_flight',
				Title: 'First Flight',
				Description: 'Finish your first movie.',
				Icon: 'rocket_launch',
				Category: 'Movies',
				Unlocked: true,
				UnlockedAt: '2026-07-01T12:00:00Z',
				CurrentValue: 1,
				TargetValue: 1,
				Rarity: 'Rare'
			};
			const progressBadge = {
				Id: 'movie-night',
				Key: 'movie_night',
				Title: 'Movie Night',
				Description: 'Finish ten movies.',
				Icon: 'movie',
				Category: 'Movies',
				Unlocked: false,
				CurrentValue: 4,
				TargetValue: 10,
				Rarity: 'Common'
			};
			if (path.endsWith('/recent-unlocks') || path.endsWith('/equipped')) {
				await json(route, [badge]);
				return;
			}
			if (path === `/Plugins/AchievementBadges/users/${USER_ID}`) {
				await json(route, [badge, progressBadge]);
				return;
			}
		}

		if (path.startsWith('/GetAvatar/')) {
			if (!getAvatarAvailable) {
				await json(route, { error: 'Plugin not installed' }, 404);
				return;
			}

			if (path === '/GetAvatar/Avatars') {
				await json(route, [
					{
						Id: 'avatar-1',
						Name: 'Orbit',
						FileName: 'orbit.svg',
						DateAdded: '2026-07-01T12:00:00Z',
						Category: 'Space'
					}
				]);
				return;
			}

			if (path === '/GetAvatar/SetAvatar' && request.method() === 'POST') {
				avatarSetBodies?.push(request.postDataJSON() as Record<string, unknown>);
				await json(route, { message: 'Avatar set successfully' });
				return;
			}

			if (path === `/GetAvatar/UserAvatar/${USER_ID}` || path === '/GetAvatar/Image/avatar-1') {
				await route.fulfill({
					status: 200,
					contentType: 'image/svg+xml',
					body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />'
				});
				return;
			}
		}

		if (path === '/UserItems/Resume' && query.get('userid') === USER_ID) {
			await json(route, { Items: [resumeEpisode], TotalRecordCount: 1 });
			return;
		}

		if (path === '/Shows/NextUp') {
			await json(route, { Items: [nextEpisode], TotalRecordCount: 1 });
			return;
		}

		if (path === '/Items' && query.get('userid') === USER_ID) {
			const searchTerm = query.get('searchterm');
			if (searchTerm) {
				const Items = searchTerm.toLowerCase().includes('signal') ? [latestMovie] : [];
				await json(route, { Items, TotalRecordCount: Items.length });
				return;
			}

			if (query.get('isfavorite') === 'true') {
				await json(route, { Items: [favoriteMovie], TotalRecordCount: 1 });
				return;
			}

			const sortBy = query.get('sortby')?.toLowerCase() ?? '';
			if (sortBy.includes('datecreated')) {
				await json(route, { Items: [latestMovie], TotalRecordCount: 1 });
				return;
			}

			const featured = sortBy.includes('random')
				? featuredMovie
				: query.get('includeitemtypes')?.toLowerCase().includes('series')
					? featuredSeries
					: featuredMovie;
			await json(route, { Items: [featured], TotalRecordCount: 1 });
			return;
		}

		await json(route, { error: `Unhandled Jellyfin fixture: ${path}` }, 404);
	});
}
