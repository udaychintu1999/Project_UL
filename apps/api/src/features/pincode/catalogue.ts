/** Immutable, owner-installed Department of Posts offline PIN directory.
 * NEVER resolve PIN codes to fabricated GPS coordinates or H3 cells.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const defaultDirectory = () => {
  const dir=process.env.ULUV_PIN_PRIVATE_DIR;
  if(!dir || !dir.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(dir))throw new Error('No private India Post directory installed');
  return resolve(dir);
};
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const pinPattern = /^[1-9][0-9]{5}$/;
export type PostalOffice = { office: string; district: string; state: string; officeType: string; delivery: string };
type PrefixMeta = { prefix: string; path: string; sha256: string; bytes: number; pinCount: number; officeCount: number };
export type PostalManifest = { schemaVersion: number; version: string; country: string; prefixes: PrefixMeta[]; sourceName: string; sourceUrl: string; sourceDate: string; counts: {distinctPins: number; acceptedOfficeRows: number} };
type PostalPack = {schemaVersion:number;version:string;prefix:string;pincodes:Record<string,PostalOffice[]>};

export class PinCatalogue {
  private readonly prefixes = new Map<string,PrefixMeta>();
  private readonly cache = new Map<string,PostalPack>();
  readonly manifest: PostalManifest;
  private readonly directory: string;
  private constructor(manifest: PostalManifest, directory: string) {
    this.manifest=manifest;this.directory=directory;
    if (manifest.schemaVersion!==1 || manifest.country!=='IN' || !/^PIN-[a-f0-9]{16}$/.test(manifest.version) ||
        !Array.isArray(manifest.prefixes) || manifest.prefixes.length>900) throw new Error('Postal manifest invalid');
    for (const meta of manifest.prefixes) {
      if (!/^[1-9][0-9]{2}$/.test(meta.prefix) || meta.path!==`prefixes/${meta.prefix}.json` ||
          !/^[a-f0-9]{64}$/.test(meta.sha256) || !Number.isSafeInteger(meta.bytes) ||
          meta.bytes<1 || meta.bytes>1_600_000 || this.prefixes.has(meta.prefix)) throw new Error('Postal prefix metadata invalid');
      this.prefixes.set(meta.prefix,meta);
    }
  }
  static async open(root = defaultDirectory()): Promise<PinCatalogue> {
    const directory=resolve(root);
    const raw=await readFile(join(directory,'manifest.json'));
    if(raw.length>250_000)throw new Error('Postal manifest too large');
    return new PinCatalogue(JSON.parse(raw.toString('utf8')) as PostalManifest, directory);
  }
  async lookup(pin: string): Promise<PostalOffice[] | null> {
    if (!pinPattern.test(pin)) return null;
    const prefix=pin.slice(0,3),meta=this.prefixes.get(prefix);
    if (!meta) return null;
    let pack=this.cache.get(prefix);
    if (!pack) {
      const path=resolve(this.directory,meta.path);
      if(!path.startsWith(this.directory+sep))throw new Error('Postal path rejected');
      const bytes=await readFile(path);
      if(bytes.length!==meta.bytes || sha(bytes)!==meta.sha256)throw new Error('Postal checksum mismatch');
      const decoded=JSON.parse(bytes.toString('utf8')) as PostalPack;
      if(decoded.schemaVersion!==1 || decoded.version!==this.manifest.version || decoded.prefix!==prefix ||
          typeof decoded.pincodes!=='object' || !decoded.pincodes ||
          Object.keys(decoded.pincodes).length!==meta.pinCount)throw new Error('Postal pack schema mismatch');
      pack=decoded;
      if(this.cache.size>=6)this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(prefix,pack);
    }
    const offices=pack.pincodes[pin];
    if(!offices)return null;
    if(!Array.isArray(offices) || offices.length>2000 || offices.some(x => !x || typeof x.office!=='string' || typeof x.state!=='string' || typeof x.district!=='string')) {
      throw new Error('Postal entries schema invalid');
    }
    return offices;
  }
}

export function validPin(pin: unknown): pin is string {return typeof pin==='string' && pinPattern.test(pin);}
