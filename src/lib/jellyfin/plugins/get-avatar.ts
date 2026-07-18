import type { Api } from '@jellyfin/sdk';
import { PluginHttpClient, asRecord, stringProperty, type FetchLike } from '../capabilities.js';
import type { CapabilityState } from '../types.js';

export interface AvatarOption {
	id: string;
	name: string;
	fileName: string;
	dateAdded?: string;
	category: string;
	imageUrl: string;
}

function decodeAvatar(client: PluginHttpClient, value: unknown): AvatarOption | null {
	const record = asRecord(value);
	const id = stringProperty(record, 'Id', 'id');
	if (!id) return null;
	return {
		id,
		name: stringProperty(record, 'Name', 'name') ?? id,
		fileName: stringProperty(record, 'FileName', 'fileName') ?? '',
		dateAdded: stringProperty(record, 'DateAdded', 'dateAdded'),
		category: stringProperty(record, 'Category', 'category') ?? '',
		imageUrl: client.url(`/GetAvatar/Image/${encodeURIComponent(id)}`)
	};
}

export class GetAvatarAdapter {
	readonly client: PluginHttpClient;

	constructor(api: Api, fetchImpl?: FetchLike) {
		this.client = new PluginHttpClient(api, fetchImpl);
	}

	probe(): Promise<CapabilityState<AvatarOption[]>> {
		return this.list();
	}

	list(): Promise<CapabilityState<AvatarOption[]>> {
		return this.client.json('/GetAvatar/Avatars', {
			decode: (value) =>
				(Array.isArray(value) ? value : [])
					.map((item) => decodeAvatar(this.client, item))
					.filter((avatar): avatar is AvatarOption => avatar !== null)
		});
	}

	current(userId: string): Promise<CapabilityState<{ url: string }>> {
		return this.client.resource(`/GetAvatar/UserAvatar/${encodeURIComponent(userId)}`);
	}

	set(avatarId: string, userId?: string): Promise<CapabilityState<{ message: string }>> {
		return this.client.json('/GetAvatar/SetAvatar', {
			method: 'POST',
			body: { AvatarId: avatarId, ...(userId ? { UserId: userId } : {}) },
			decode: (value) => ({
				message: stringProperty(asRecord(value), 'message', 'Message') ?? 'Avatar set successfully'
			})
		});
	}
}
