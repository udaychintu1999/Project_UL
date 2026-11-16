import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { MAX_MEDIA_BYTES, MAX_MEDIA_DIMENSION, MAX_MEDIA_PIXELS, VALID_IMAGE_FORMATS, validMediaId } from './media-policy.js';

export class InvalidImageError extends Error {
  constructor(readonly reason: string) { super(reason); }
}

/** A private filesystem adapter for developer computers; NOT production media. */
export class LocalMediaStore {
  // Stable project-root path even when npm --workspace runs with apps/api CWD.
  constructor(readonly root = resolve(dirname(fileURLToPath(import.meta.url)),
      '../../../../..', '.local', 'media')) {
    if (!isAbsolute(root)) throw new Error('Local media root must be absolute');
  }
  private hashedOwner(uid: string): string { return createHash('sha256').update(uid).digest('hex').slice(0, 32); }
  private objectPath(uid: string, mediaId: string): string {
    if (!validMediaId(mediaId)) throw new InvalidImageError('invalid_media_id');
    return join(this.root, 'objects', this.hashedOwner(uid), `${mediaId}.jpg`);
  }
  private async safeDirs(): Promise<void> {
    const parent = resolve(this.root, '..');
    await mkdir(parent, { recursive: true, mode: 0o700 });
    if ((await lstat(parent)).isSymbolicLink()) throw new InvalidImageError('unsafe_media_store');
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await mkdir(join(this.root, 'tmp'), { recursive: true, mode: 0o700 });
    await mkdir(join(this.root, 'objects'), { recursive: true, mode: 0o700 });
    for (const folder of [this.root, join(this.root, 'tmp'), join(this.root, 'objects')]) {
      if ((await lstat(folder)).isSymbolicLink()) throw new InvalidImageError('unsafe_media_store');
    }
  }
  async ingest(uid: string, mediaId: string, body: Readable): Promise<{ bytes: number; sha256: string; format: 'jpeg'; width: number; height: number }> {
    await this.safeDirs();
    const ownerFolder = join(this.root, 'objects', this.hashedOwner(uid));
    await mkdir(ownerFolder, { recursive: true, mode: 0o700 });
    if ((await lstat(ownerFolder)).isSymbolicLink()) throw new InvalidImageError('unsafe_media_store');
    const nonce = randomUUID();
    const input = join(this.root, 'tmp', `${nonce}.part`);
    const output = join(this.root, 'tmp', `${nonce}.jpg`);
    let size = 0;
    const limit = new Transform({ transform(chunk: Buffer, _encoding, cb) {
      size += chunk.length;
      if (size > MAX_MEDIA_BYTES) cb(new InvalidImageError('image_too_large'));
      else cb(null, chunk);
    } });
    try {
      await pipeline(body, limit, createWriteStream(input, { flags: 'wx', mode: 0o600 }),
        { signal: AbortSignal.timeout(90_000) });
      if (size < 32) throw new InvalidImageError('invalid_image');
      // Sharp decodes pixel content, rejects SVG, corrupt image data and decompression bombs.
      const reader = sharp(input, { limitInputPixels: MAX_MEDIA_PIXELS, failOn: 'error', sequentialRead: true });
      const info = await reader.metadata();
      if (!info.format || !VALID_IMAGE_FORMATS.has(info.format) || !info.width || !info.height ||
          info.width > MAX_MEDIA_DIMENSION || info.height > MAX_MEDIA_DIMENSION ||
          info.width * info.height > MAX_MEDIA_PIXELS || info.pages !== undefined && info.pages > 1) {
        throw new InvalidImageError('invalid_image');
      }
      // Explicitly re-encode to a single static JPEG, dropping EXIF, GPS, ICC and all text metadata.
      const converted = await reader.rotate().flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: false }).toFile(output);
      if (converted.size > MAX_MEDIA_BYTES) throw new InvalidImageError('image_too_large');
      const sanitized = await readFile(output);
      const digest = createHash('sha256').update(sanitized).digest('hex');
      const destination = this.objectPath(uid, mediaId);
      // Only the server-generated UUID and authenticated UID determine the destination.
      // Reject any existing object rather than overwriting shared/referenced media.
      try { await lstat(destination); throw new InvalidImageError('media_object_exists'); }
      catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
      await rename(output, destination);
      return { bytes: converted.size, sha256: digest, format: 'jpeg', width: converted.width, height: converted.height };
    } catch (error) {
      if (error instanceof InvalidImageError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new InvalidImageError('upload_timed_out');
      throw new InvalidImageError('invalid_image');
    } finally {
      await rm(input, { force: true }).catch(() => {});
      await rm(output, { force: true }).catch(() => {});
    }
  }
  async inspectMetadata(uid: string, mediaId: string): Promise<{ bytes: number; sha256: string; format: 'jpeg'; width: number; height: number }> {
    const data = await this.read(uid, mediaId);
    const metadata = await sharp(data, { limitInputPixels: MAX_MEDIA_PIXELS, failOn: 'error' }).metadata();
    if (metadata.format !== 'jpeg' || !metadata.width || !metadata.height || metadata.exif ||
        metadata.width * metadata.height > MAX_MEDIA_PIXELS || metadata.width > MAX_MEDIA_DIMENSION ||
        metadata.height > MAX_MEDIA_DIMENSION) throw new InvalidImageError('invalid_image');
    return { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'),
      format: 'jpeg', width: metadata.width, height: metadata.height };
  }
  async exists(uid: string, mediaId: string): Promise<boolean> {
    try { const info = await lstat(this.objectPath(uid, mediaId)); return info.isFile() && !info.isSymbolicLink(); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
  }
  async read(uid: string, mediaId: string): Promise<Buffer> {
    const file = this.objectPath(uid, mediaId);
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_MEDIA_BYTES) throw new InvalidImageError('media_not_found');
    return readFile(file);
  }
  async remove(uid: string, mediaId: string): Promise<void> { await rm(this.objectPath(uid, mediaId), { force: true }); }
  /** Manual/periodic development-only purge of aged temp files; never walks real user data. */
  async purgeExpired(): Promise<number> {
    await this.safeDirs();
    const { readdir } = await import('node:fs/promises');
    let removed = 0;
    for (const name of await readdir(join(this.root, 'tmp'))) {
      if (!/^[0-9a-f-]{36}\.(?:part|jpg)$/.test(name)) continue;
      const file = join(this.root, 'tmp', name);
      const info = await lstat(file);
      if (info.isSymbolicLink() || !info.isFile()) continue;
      if (Date.now() - info.mtimeMs > 60 * 60 * 1000) { await rm(file, { force: true }); removed++; }
    }
    return removed;
  }
}
