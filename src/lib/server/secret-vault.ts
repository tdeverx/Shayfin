import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;

export const EncryptedSecretSchema = z.object({
	algorithm: z.literal(ENCRYPTION_ALGORITHM),
	iv: z.string().min(1),
	ciphertext: z.string(),
	authTag: z.string().min(1)
});

export type EncryptedSecret = z.infer<typeof EncryptedSecretSchema>;

export class SecretVault {
	private keyPromise?: Promise<Buffer>;

	constructor(private readonly directory: string) {}

	private async loadKey(): Promise<Buffer> {
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		const keyPath = path.join(this.directory, 'secret.key');

		try {
			const existing = await readFile(keyPath);
			if (existing.length !== 32) {
				throw new Error('secret.key must contain exactly 32 bytes.');
			}
			await chmod(keyPath, 0o600);
			return existing;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}

		const generated = randomBytes(32);
		try {
			const handle = await open(keyPath, 'wx', 0o600);
			try {
				await handle.writeFile(generated);
				await handle.sync();
			} finally {
				await handle.close();
			}
			return generated;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const raced = await readFile(keyPath);
			if (raced.length !== 32) {
				throw new Error('secret.key must contain exactly 32 bytes.', { cause: error });
			}
			await chmod(keyPath, 0o600);
			return raced;
		}
	}

	private key(): Promise<Buffer> {
		this.keyPromise ??= this.loadKey();
		return this.keyPromise;
	}

	async initialize(): Promise<void> {
		await this.key();
	}

	async encrypt(value: string): Promise<EncryptedSecret> {
		const key = await this.key();
		const iv = randomBytes(12);
		const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
		const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

		return {
			algorithm: ENCRYPTION_ALGORITHM,
			iv: iv.toString('base64url'),
			ciphertext: ciphertext.toString('base64url'),
			authTag: cipher.getAuthTag().toString('base64url')
		};
	}

	async decrypt(value: EncryptedSecret): Promise<string> {
		const parsed = EncryptedSecretSchema.parse(value);
		const key = await this.key();
		const decipher = createDecipheriv(parsed.algorithm, key, Buffer.from(parsed.iv, 'base64url'));
		decipher.setAuthTag(Buffer.from(parsed.authTag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
			decipher.final()
		]).toString('utf8');
	}
}
