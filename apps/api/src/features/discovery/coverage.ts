import {
  cellToLatLng, getResolution, isValidCell, latLngToCell, polygonToCellsExperimental,
  POLYGON_TO_CELLS_FLAGS
} from 'h3-js';
import {MAX_CELLS_IN_COVER, RESOLUTION, enclosingCircle, validCoordinates, distanceKm, bandForDistance,
  type Coordinates, type DistanceBand, requestedBands} from './contracts.js';

export function isR6Cell(cell:unknown):cell is string {
  return typeof cell==='string'&&isValidCell(cell)&&getResolution(cell)===RESOLUTION;
}
/** This also rejects caller-supplied arbitrary centers, not just H3 syntax. */
export function validatedApproximateCenter(cell:unknown,center:unknown):Coordinates {
  if(!isR6Cell(cell)||!validCoordinates(center))throw new Error('untrusted_locality');
  const [lat,lng]=cellToLatLng(cell);
  if(Math.abs(center.lat-lat)>1e-6||Math.abs(center.lng-lng)>1e-6)
    throw new Error('untrusted_locality');
  return {lat,lng};
}
export function selectCell(lat:number,lng:number):string {
  if(!validCoordinates({lat,lng}))throw new Error('invalid_geo_coordinates');
  return latLngToCell(lat,lng,RESOLUTION);
}
/** Experimental OVERLAPPING mode is intentional. Center-contained polyfill can
 * omit candidate home cells overlapping a 10/35/50 km circle. Extra 250 m
 * compensates for chords approximating geodesic circle arcs. Exact filtering
 * separately rejects everything outside the real user-selected band. */
export function conservativeCellCover(center:Coordinates,radiusKm:10|35|50):readonly string[] {
  if(!validCoordinates(center)||![10,35,50].includes(radiusKm))throw new Error('invalid_cover');
  const geoJsonLoop=enclosingCircle(center,radiusKm+0.25);
  const cells=polygonToCellsExperimental([geoJsonLoop],RESOLUTION,
    POLYGON_TO_CELLS_FLAGS.containmentOverlapping,true);
  const origin=selectCell(center.lat,center.lng);
  const unique=new Set<string>([...cells,origin]);
  if(unique.size>MAX_CELLS_IN_COVER||unique.size===0||
    [...unique].some(cell=>!isR6Cell(cell)))throw new Error('geo_cover_budget_exceeded');
  // Geographic ordering matters operationally: the scanner is capped at six
  // empty PK Queries per request. Lexicographic H3 ordering could hide a
  // same-cell candidate dozens of empty cursor pages away.
  return [...unique].sort((a,b)=>{
    const [aLat,aLng]=cellToLatLng(a),[bLat,bLng]=cellToLatLng(b);
    return distanceKm(center,{lat:aLat,lng:aLng})-distanceKm(center,{lat:bLat,lng:bLng})||a.localeCompare(b);
  });
}
export type BandCover={band:Exclude<DistanceBand,'0-50'>;cells:readonly string[]};
export function planBandCovers(center:Coordinates,selected:DistanceBand):readonly BandCover[]{
  const bands=requestedBands(selected);
  return bands.map(band=>({band,cells:conservativeCellCover(center,
    band==='0-10'?10:band==='10-35'?35:50).filter(cell=>{
      // Every published candidate center is the canonical R6 cell centroid.
      // Do not query inner-band cells again in outer phases; final candidate
      // hydration independently rechecks the exact selected locality.
      const [lat,lng]=cellToLatLng(cell);
      return bandForDistance(distanceKm(center,{lat,lng}))===band;
    })}));
}
