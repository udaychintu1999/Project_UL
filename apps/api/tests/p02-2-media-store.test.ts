/** Execute with: npx tsx --test apps/api/tests/p02-2-media-store.test.ts */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, rm, symlink, mkdir, readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {InvalidImageError, LocalMediaStore} from '../src/features/profiles/local-media-store.js';
const uid = '22222222-2222-4222-8222-222222222222';

test('P02-2 private local adapter decodes PNG/WebP, strips EXIF and preserves restart state', async () => {
  const base = await mkdtemp(join(tmpdir(), 'uluv-media-synthetic-'));
  const store = new LocalMediaStore(join(base, 'media'));
  const id = randomUUID();
  try {
    const png = await sharp({create: {width: 40, height: 32, channels: 3,
      background: '#337799'}}).png().toBuffer();
    const inserted = await store.ingest(uid, id, Readable.from(png));
    assert.equal(inserted.format, 'jpeg');
    assert.equal(inserted.width, 40);
    assert.equal(await store.exists(uid, id), true);
    const reopened = new LocalMediaStore(join(base, 'media'));
    const bytes = await reopened.read(uid, id);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.exif, undefined);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), inserted.sha256);
    await reopened.remove(uid, id);
    assert.equal(await reopened.exists(uid, id), false);
  } finally { await rm(base, {recursive: true, force: true}); }
});

test('P02-2 local adapter rejects malformed streams and symlink media root', async (t) => {
  const base = await mkdtemp(join(tmpdir(), 'uluv-media-synthetic-'));
  const id = randomUUID();
  try {
    const store = new LocalMediaStore(join(base, 'media'));
    await assert.rejects(() => store.ingest(uid, id, Readable.from([Buffer.from('not an image'.repeat(5))])),
      (error: unknown) => error instanceof InvalidImageError && error.reason === 'invalid_image');
    const real = join(base, 'real');
    const linkedPath = join(base, 'linked');
    await mkdir(real, {recursive: true});
    try {
      // Ordinary Windows users cannot usually create directory symlinks.
      // NTFS junctions exercise the same lstat-based media-root protection
      // without requiring Developer Mode or administrator permissions.
      await symlink(real, linkedPath, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (process.platform === 'win32' && error instanceof Error && 'code' in error &&
          (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP')) {
        t.diagnostic('Windows policy denied even a directory junction: symlink-root assertion unverified; malformed-image assertion passed.');
        return;
      }
      throw error;
    }
    const linked = new LocalMediaStore(join(linkedPath, 'media'));
    // Must reject the symlink/junction parent specifically, not merely the
    // deliberately invalid input bytes used in this negative test.
    await assert.rejects(
      () => linked.ingest(uid, randomUUID(), Readable.from([Buffer.from('fake')])),
      (error: unknown) => error instanceof InvalidImageError && error.reason === 'unsafe_media_store',
    );
  } finally { await rm(base, {recursive: true, force: true}); }
});
