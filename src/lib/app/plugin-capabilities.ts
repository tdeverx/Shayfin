import type { BootstrapResponse } from '$lib/server/contracts';

export type PluginCapability = keyof NonNullable<BootstrapResponse['plugins']>;

export function pluginEnabled(
	bootstrap: BootstrapResponse | null | undefined,
	plugin: PluginCapability
): boolean {
	return bootstrap?.plugins?.[plugin]?.enabled === true;
}
