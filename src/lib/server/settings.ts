import type { AppConfig, StoredIntegration, StoredServarrInstance } from './config';

export interface MaskedIntegration {
	enabled: boolean;
	url: string;
	apiKeyConfigured: boolean;
	mappedUsers?: number;
}

export function maskIntegration(integration: StoredIntegration | undefined): MaskedIntegration {
	return {
		enabled: integration?.enabled ?? false,
		url: integration?.url ?? '',
		apiKeyConfigured: integration?.apiKey !== undefined,
		...(integration?.userMappings
			? { mappedUsers: Object.keys(integration.userMappings).length }
			: {})
	};
}

export interface MaskedServarrInstance {
	id: string;
	label: string;
	enabled: boolean;
	url: string;
	apiKeyConfigured: boolean;
}

export function maskServarrInstance(instance: StoredServarrInstance): MaskedServarrInstance {
	return {
		id: instance.id,
		label: instance.label,
		enabled: instance.enabled,
		url: instance.url,
		apiKeyConfigured: instance.apiKey !== undefined
	};
}

export function maskAdminSettings(config: AppConfig) {
	return {
		jellyfin: config.jellyfin
			? {
					publicUrl: config.jellyfin.publicUrl,
					internalUrl: config.jellyfin.internalUrl ?? '',
					serverId: config.jellyfin.serverId,
					serverName: config.jellyfin.serverName,
					serverVersion: config.jellyfin.serverVersion
				}
			: null,
		integrations: {
			seerr: maskIntegration(config.integrations.seerr),
			sonarr: config.integrations.sonarr.map(maskServarrInstance),
			radarr: config.integrations.radarr.map(maskServarrInstance)
		},
		plugins: {
			homeScreenSections: { enabled: config.plugins.homeScreenSections?.enabled ?? false },
			mediaBarEnhanced: { enabled: config.plugins.mediaBarEnhanced?.enabled ?? false },
			achievementBadges: {
				enabled: config.plugins.achievementBadges?.enabled ?? false,
				unlockNotifications: config.plugins.achievementBadges?.unlockNotifications ?? true
			},
			getAvatar: { enabled: config.plugins.getAvatar?.enabled ?? false }
		}
	};
}
