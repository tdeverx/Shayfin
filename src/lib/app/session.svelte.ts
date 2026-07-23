import { browser } from '$app/environment';
import { Jellyfin, type Api } from '@jellyfin/sdk';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api';
import { getOrCreateDeviceId } from '$lib/jellyfin/storage';
import type { AppUser, MediaNavigationItem } from './models';
import { clearDataCache } from './data-cache';
import {
	DEFAULT_BROWSER_PREFERENCES,
	loadBrowserPreferences,
	saveBrowserPreferences,
	type BrowserPreferencesV1,
	type PlaybackQuality
} from './preferences';

export interface BootstrapState {
	configured: boolean;
	version: string;
	jellyfin?: {
		publicUrl: string;
		server: { id: string; name: string; version?: string };
	};
	plugins?: {
		homeScreenSections: { enabled: boolean };
		mediaBarEnhanced: { enabled: boolean };
		achievementBadges: { enabled: boolean; unlockNotifications: boolean };
		getAvatar: { enabled: boolean };
	};
}

function makeDeviceId(): string {
	if (!browser) return 'shayfin-server-render';
	return getOrCreateDeviceId();
}

function tokenKey(serverId: string): string {
	return `shayfin:${serverId}:access-token`;
}

function themeAudioKey(serverId: string, userId: string): string {
	return `shayfin:${serverId}:${userId}:theme-audio`;
}

function toAppUser(serverUrl: string, user: UserDto): AppUser {
	const id = user.Id ?? '';
	const imageUrl = user.PrimaryImageTag
		? `${serverUrl}/Users/${encodeURIComponent(id)}/Images/Primary?tag=${encodeURIComponent(user.PrimaryImageTag)}`
		: undefined;
	return {
		id,
		name: user.Name ?? 'Jellyfin user',
		isAdministrator: user.Policy?.IsAdministrator === true,
		imageUrl
	};
}

class SessionState {
	bootstrap = $state<BootstrapState | null>(null);
	api = $state<Api | null>(null);
	userDto = $state<UserDto | null>(null);
	user = $state<AppUser | null>(null);
	navigation = $state<MediaNavigationItem[]>([{ id: 'home', label: 'Home', href: '/home' }]);
	loading = $state(true);
	error = $state<string | null>(null);
	themeAudioEnabled = $state(false);
	preferences = $state<BrowserPreferencesV1>(structuredClone(DEFAULT_BROWSER_PREFERENCES));
	private initialized?: Promise<void>;

	get accessToken(): string | null {
		return this.api?.accessToken || null;
	}

	get authorizationHeaders(): HeadersInit {
		return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
	}

	initialize(): Promise<void> {
		this.initialized ??= this.load();
		return this.initialized;
	}

	private async load(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const response = await fetch('/api/bootstrap');
			if (!response.ok) throw new Error('Unable to load Shayfin configuration.');
			this.bootstrap = (await response.json()) as BootstrapState;
			if (!this.bootstrap.configured || !this.bootstrap.jellyfin || !browser) return;

			const token = localStorage.getItem(tokenKey(this.bootstrap.jellyfin.server.id));
			if (!token) return;
			await this.restore(token);
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Unable to initialize Shayfin.';
		} finally {
			this.loading = false;
		}
	}

	private createApi(token?: string): Api {
		if (!this.bootstrap?.jellyfin) throw new Error('Shayfin has not been configured.');
		const jellyfin = new Jellyfin({
			clientInfo: { name: 'Shayfin', version: this.bootstrap.version },
			deviceInfo: {
				name: browser ? navigator.platform || 'Browser' : 'Browser',
				id: makeDeviceId()
			}
		});
		return jellyfin.createApi(this.bootstrap.jellyfin.publicUrl, token);
	}

	async restore(token: string): Promise<void> {
		const api = this.createApi(token);
		try {
			const response = await getUserApi(api).getCurrentUser();
			await this.accept(api, response.data);
		} catch (error) {
			if (this.bootstrap?.jellyfin && browser) {
				localStorage.removeItem(tokenKey(this.bootstrap.jellyfin.server.id));
			}
			throw error;
		}
	}

	async login(username: string, password: string): Promise<void> {
		const api = this.createApi();
		const response = await getUserApi(api).authenticateUserByName({
			authenticateUserByName: { Username: username, Pw: password }
		});
		const user = response.data.User;
		const token = response.data.AccessToken;
		if (!user || !token) throw new Error('Jellyfin did not return a usable session.');
		api.accessToken = token;
		await this.accept(api, user);
	}

	private async accept(api: Api, user: UserDto): Promise<void> {
		if (!this.bootstrap?.jellyfin || !user.Id)
			throw new Error('The Jellyfin user is missing an identifier.');
		this.api = api;
		this.userDto = user;
		this.user = toAppUser(this.bootstrap.jellyfin.publicUrl, user);
		if (browser) {
			localStorage.setItem(tokenKey(this.bootstrap.jellyfin.server.id), api.accessToken);
			this.preferences = loadBrowserPreferences(
				this.bootstrap.jellyfin.server.id,
				user.Id,
				localStorage.getItem(themeAudioKey(this.bootstrap.jellyfin.server.id, user.Id))
			);
			this.themeAudioEnabled = this.preferences.experience.themeAudio;
			this.persistPreferences();
		}
		// Navigation is enhancement data. Do not make every authenticated route wait for
		// an extra UserViews round-trip before it can render its own required content.
		void this.loadNavigation().catch(() => {
			// Keep Home available when a server does not expose library views yet.
		});
	}

	private async loadNavigation(): Promise<void> {
		if (!this.api || !this.user?.id) return;
		const response = await getUserViewsApi(this.api).getUserViews({
			userId: this.user.id,
			includeExternalContent: false
		});
		const types = new Set(response.data.Items?.map((item) => item.CollectionType).filter(Boolean));
		this.navigation = [
			{ id: 'home', label: 'Home', href: '/home' },
			...(types.has('movies') ? [{ id: 'movies' as const, label: 'Movies', href: '/movies' }] : []),
			...(types.has('tvshows') ? [{ id: 'series' as const, label: 'Shows', href: '/series' }] : [])
		];
	}

	setThemeAudio(enabled: boolean): void {
		this.themeAudioEnabled = enabled;
		this.preferences.experience.themeAudio = enabled;
		this.persistPreferences();
	}

	setPlaybackQuality(quality: PlaybackQuality): void {
		this.preferences.playback.quality = quality;
		this.persistPreferences();
	}

	setAutoplayNext(enabled: boolean): void {
		this.preferences.playback.autoplayNext = enabled;
		this.persistPreferences();
	}

	private persistPreferences(): void {
		if (browser && this.bootstrap?.jellyfin && this.user?.id) {
			saveBrowserPreferences(this.bootstrap.jellyfin.server.id, this.user.id, this.preferences);
		}
	}

	async logout(): Promise<void> {
		try {
			if (this.api) await getSessionApi(this.api).reportSessionEnded();
		} finally {
			clearDataCache();
			if (browser && this.bootstrap?.jellyfin)
				localStorage.removeItem(tokenKey(this.bootstrap.jellyfin.server.id));
			this.api = null;
			this.userDto = null;
			this.user = null;
			this.preferences = structuredClone(DEFAULT_BROWSER_PREFERENCES);
			this.themeAudioEnabled = false;
			this.navigation = [{ id: 'home', label: 'Home', href: '/home' }];
		}
	}
}

export const session = new SessionState();
