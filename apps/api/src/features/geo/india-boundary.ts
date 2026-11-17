/** Bundled, independently checksum-pinned India country boundary.
 * Source: geoBoundaries IND ADM1 simplified, ADM1 polygons united without extra
 * simplification. Attribution and licence: apps/api/assets/geo/ATTRIBUTION.md.
 * Loaded once per API process, never fetched for a user's GPS request.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const INDIA_BOUNDARY_SHA256 = 'b1af3edb4f806a1b787ff61e366cfae15b14407bda4c131dbff914193f1a65f8';
const DEFAULT_FILE = fileURLToPath(new URL('../../../assets/geo/india-boundary.geojson', import.meta.url));
type Point = readonly [number, number];
type Ring = Point[];
type Polygon = Ring[];
type BoundedPolygon = { rings: Polygon; box: readonly [number,number,number,number] };

function onSegment(point: Point, a: Point, b: Point): boolean {
  const cross=(point[0]-a[0])*(b[1]-a[1])-(point[1]-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)>1e-10)return false;
  return point[0]>=Math.min(a[0],b[0])-1e-12 && point[0]<=Math.max(a[0],b[0])+1e-12 &&
    point[1]>=Math.min(a[1],b[1])-1e-12 && point[1]<=Math.max(a[1],b[1])+1e-12;
}
/** Ray casting with boundary detection; point order is [longitude, latitude]. */
function ringContains(point: Point, ring: Ring): 'inside'|'outside'|'edge' {
  let inside=false;
  const [x,y]=point;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[j],b=ring[i];
    if(onSegment(point,a,b))return 'edge';
    if((a[1]>y)!==(b[1]>y) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?'inside':'outside';
}
export class IndiaBoundary {
  private readonly polygons: BoundedPolygon[];
  private constructor(polygons: BoundedPolygon[]) { this.polygons=polygons; }
  contains(lat:number,lng:number):boolean {
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180)return false;
    const point:Point=[lng,lat];
    for(const poly of this.polygons) {
      const [west,south,east,north]=poly.box;
      if(lng<west||lng>east||lat<south||lat>north)continue;
      const shell=ringContains(point,poly.rings[0]);
      if(shell==='outside')continue;
      if(shell==='edge')return true;
      let inHole=false;
      for(const hole of poly.rings.slice(1)) {
        const found=ringContains(point,hole);
        if(found==='edge')return true;
        if(found==='inside'){inHole=true;break;}
      }
      if(!inHole)return true;
    }
    return false;
  }
  static fromBytes(bytes:Buffer, sha=INDIA_BOUNDARY_SHA256):IndiaBoundary {
    if(bytes.length<100 || bytes.length>4_000_000 || createHash('sha256').update(bytes).digest('hex')!==sha) {
      throw new Error('India boundary source/integrity verification failed');
    }
    const feature=JSON.parse(bytes.toString('utf8')) as {type?:string;geometry?:{type?:string;coordinates?:unknown}};
    if(feature.type!=='Feature'||feature.geometry?.type!=='MultiPolygon'||!Array.isArray(feature.geometry.coordinates)) {
      throw new Error('Invalid India GeoJSON boundary type');
    }
    const geometries=feature.geometry.coordinates;
    if(geometries.length<20||geometries.length>1000)throw new Error('Unexpected India boundary polygon count');
    let vertexCount=0;
    const polygons:BoundedPolygon[]=geometries.map((p):BoundedPolygon=>{
      if(!Array.isArray(p)||!p.length||p.length>500)throw new Error('Invalid boundary polygon');
      const rings:Polygon=p.map((r):Ring=>{
        if(!Array.isArray(r)||r.length<4)throw new Error('Invalid boundary ring');
        vertexCount+=r.length;
        if(vertexCount>120000)throw new Error('Boundary vertex budget exceeded');
        const out:Ring=r.map((v):Point=>{
          if(!Array.isArray(v)||v.length!==2||typeof v[0]!=='number'||typeof v[1]!=='number'||
             !Number.isFinite(v[0])||!Number.isFinite(v[1])||Math.abs(v[0])>180||Math.abs(v[1])>90) {
             throw new Error('Invalid boundary coordinate');
          }
          return [v[0],v[1]];
        });
        if(out[0][0]!==out.at(-1)![0]||out[0][1]!==out.at(-1)![1])throw new Error('Unclosed boundary ring');
        return out;
      });
      const exterior=rings[0];
      return {rings,box:[Math.min(...exterior.map(x=>x[0])),Math.min(...exterior.map(x=>x[1])),
        Math.max(...exterior.map(x=>x[0])),Math.max(...exterior.map(x=>x[1]))]};
    });
    return new IndiaBoundary(polygons);
  }
}

/** Lazy memoization per process; a failed integrity check remains fail-closed. */
export function indiaBoundaryLoader(path=DEFAULT_FILE):()=>Promise<IndiaBoundary> {
  let pending:Promise<IndiaBoundary>|undefined;
  return ()=> pending??= readFile(path).then(b=>IndiaBoundary.fromBytes(b));
}
