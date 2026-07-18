import { getConfigStore } from '$lib/server/config';
import type { BootstrapResponse } from '$lib/server/contracts';
import { errorResponse } from '$lib/server/errors';
import { APP_VERSION } from '$lib/server/version';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const config = await getConfigStore().read();
		if (!config.jellyfin) {
			return json({ configured: false, version: APP_VERSION } satisfies BootstrapResponse);
		}

		return json({
			configured: true,
			version: APP_VERSION,
			jellyfin: {
				publicUrl: config.jellyfin.publicUrl,
				server: {
					id: config.jellyfin.serverId,
					name: config.jellyfin.serverName,
					version: config.jellyfin.serverVersion
				}
			},
			plugins: {
				homeScreenSections: { enabled: config.plugins.homeScreenSections?.enabled ?? true },
				mediaBarEnhanced: { enabled: config.plugins.mediaBarEnhanced?.enabled ?? true },
				achievementBadges: {
					enabled: config.plugins.achievementBadges?.enabled ?? true,
					unlockNotifications: config.plugins.achievementBadges?.unlockNotifications ?? true
				},
				getAvatar: { enabled: config.plugins.getAvatar?.enabled ?? true }
			}
		} satisfies BootstrapResponse);
	} catch (error) {
		return errorResponse(error);
	}
};
