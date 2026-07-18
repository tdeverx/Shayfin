import type { AppConfig, IntegrationName, StoredIntegration } from './config';

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
			sonarr: maskIntegration(config.integrations.sonarr),
			radarr: maskIntegration(config.integrations.radarr)
		}
	};
}

export function integrationLabel(name: IntegrationName): string {
	return name === 'seerr' ? 'Seerr' : name === 'sonarr' ? 'Sonarr' : 'Radarr';
}
