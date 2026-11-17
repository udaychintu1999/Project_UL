#!/usr/bin/env python3
"""P03-1B: stream the official GeoNames India UTF-8 TSV into reviewed, *plain JSON* packs.

Only stdlib dependencies. Offline and deterministic: no network, no real user data,
no AWS, no geographic inference to invent district membership.

Usage:
  python scripts/geo/india_catalogue.py build --source /path/IN.txt --out /path/geo/india/v1
  python scripts/geo/india_catalogue.py verify --out /path/geo/india/v1
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile

SCHEMA = 1
ALLOW = {'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLX', 'PPLL', 'PPLF'}
MAX_ALIASES = 12
ATTRIBUTION = {'name': 'GeoNames', 'sourceUrl': 'https://download.geonames.org/export/dump/',
               'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
               'transformation': 'Filtered eligible populated-place records; preserved native administrative codes and distinct IDs; capped aliases.'}

def rawjson(x):
    return (json.dumps(x, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)+'\n').encode('utf-8')

def sha(data): return hashlib.sha256(data).hexdigest()

def write(root: Path, rel: str, obj):
    dest = root / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = rawjson(obj)
    dest.write_bytes(data)
    return {'path': rel, 'sha256': sha(data), 'bytes': len(data)}

def safe_aliases(alts, primary, asciiname):
    """Retain useful local-script alternatives before excess romanizations.

    Only a bounded number is serialized; all aliases are from the same raw
    record, never guessed. Distinct Indian scripts are preferred when present.
    """
    candidates=[]; seen=set()
    for alias in alts.split(',') if alts else ():
        alias=alias.strip()
        if not alias or len(alias)>90 or alias in (primary, asciiname): continue
        key=alias.casefold()
        if key in seen:continue
        seen.add(key);candidates.append(alias)
    selected=[];used=set()
    for first in (0x0900,0x0980,0x0A00,0x0A80,0x0B00,0x0B80,0x0C00,0x0C80,0x0D00):
        found=next((v for v in candidates if any(first <= ord(ch) < first+0x80 for ch in v)),None)
        if found is not None and found not in used:
            selected.append(found);used.add(found)
            if len(selected)>=MAX_ALIASES:return selected
    for alias in candidates:
        if alias not in used:
            selected.append(alias);used.add(alias)
            if len(selected)>=MAX_ALIASES:break
    return selected

def scan_source(source: Path, con):
    raw = Counter(); codes = Counter(); source_hash = hashlib.sha256(); src_bytes=0
    adm1, adm2 = {}, {}; errors=[]
    seen = set()  # exact GeoNames IDs: ~660k integers, bounded to source-size; no name dedupe
    con.executescript('''CREATE TABLE places(id TEXT PRIMARY KEY,name TEXT,ascii TEXT,aliases TEXT,lat REAL,lng REAL,state TEXT,district TEXT,feature TEXT,bucket INTEGER);
       CREATE INDEX places_area ON places(state,district,id);
       CREATE INDEX places_bucket ON places(bucket);''')
    chunk=[]
    with source.open('rb') as f:
        for n,line in enumerate(f,1):
            src_bytes += len(line); source_hash.update(line); raw['rows'] += 1
            try: fields = line.rstrip(b'\r\n').decode('utf-8','strict').split('\t')
            except UnicodeDecodeError as e: raise ValueError(f'Non-UTF8 row {n}') from e
            if len(fields)!=19: raise ValueError(f'Row {n}: expected 19 fields, got {len(fields)}')
            id_,name,ascii,alts,lat_s,lng_s,feature_class,feature_code,country,_,admin1,admin2,*_=fields
            if country!='IN': raise ValueError(f'Row {n}: country is not IN')
            if not id_.isdecimal() or id_ in seen: raise ValueError(f'Row {n}: invalid or duplicate GeoNames ID')
            seen.add(id_)
            try: lat,lng=float(lat_s),float(lng_s)
            except ValueError as e: raise ValueError(f'Row {n}: invalid center') from e
            if not(-90<=lat<=90 and -180<=lng<=180): raise ValueError(f'Row {n}: invalid geographic coordinate')
            if len(name)>500 or len(ascii)>500: raise ValueError(f'Row {n}: oversized display name')
            codes[f'{feature_class}/{feature_code}']+=1
            if feature_class=='A' and feature_code=='ADM1':
                if not admin1: raise ValueError(f'ADM1 {id_} missing admin1')
                if admin1 in adm1: raise ValueError(f'Duplicate ADM1 code {admin1}')
                adm1[admin1] = {'code':admin1,'id':id_,'name':name}
            if feature_class=='A' and feature_code=='ADM2':
                if not admin1 or not admin2: raise ValueError(f'ADM2 {id_} missing codes')
                key=(admin1,admin2)
                if key in adm2: raise ValueError(f'Duplicate ADM2 codes {key}')
                adm2[key] = {'code':admin2,'id':id_,'name':name}
            if feature_class != 'P': continue
            raw['p_class']+=1
            if not admin2: raw['p_missing_admin2_all']+=1
            if feature_code not in ALLOW:
                raw['p_excluded']+=1
                continue
            raw['p_selected']+=1
            if not admin1: raw['p_selected_missing_admin1']+=1
            if not admin2: raw['p_selected_missing_admin2']+=1
            aliases = safe_aliases(alts,name,ascii)
            chunk.append((id_,name,ascii,json.dumps(aliases,ensure_ascii=False),lat,lng,admin1,admin2,feature_code,int(id_)%256))
            if len(chunk)>=2000:
                con.executemany('INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?,?)',chunk);con.commit();chunk=[]
    if chunk: con.executemany('INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?,?)',chunk);con.commit()
    return raw,codes,adm1,adm2,source_hash.hexdigest(),src_bytes

def make_place(row):
    id_,name,ascii,aliases,lat,lng,_,_,_,bucket=row
    return {'id':id_,'name':name,'asciiName':ascii,'aliases':json.loads(aliases),'lat':lat,'lng':lng}

def build(source:Path,target:Path):
    if not source.is_file(): raise ValueError('GeoNames source file missing')
    # Build in a sibling staging area; never modify a currently published catalogue.
    target=target.resolve();target.parent.mkdir(parents=True,exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix='.uluv-geo-build-',dir=target.parent))
    con=sqlite3.connect(stage/'scratch.sqlite')
    try:
        raw,codes,states,districts,source_hash,src_bytes=scan_source(source,con)
        version='IN-'+source_hash[:16]
        validdistricts={(s,d) for (s,d) in districts if s in states}
        failures=Counter(); groups=Counter(); indexed=0
        # classify *selected* populated places using authoritative GeoNames pair.
        for s,d,count in con.execute('SELECT state,district,COUNT(*) FROM places GROUP BY state,district'):
            if (s,d) in validdistricts: group=('district',s,d)
            elif s in states: group=('unmapped',s,'')
            else: group=('country_unmapped','','')
            groups[group]+=count
            if group[0]!='district':
                failures['blank_district' if not d else 'unmatched_admin2'] += count
                if not s or s not in states: failures['invalid_state'] += count
        # Stream per district, ordered by geonameid as integer (ID string, not name).
        catalog_states=[]; pack_files=[]
        for statecode,state in sorted(states.items()):
            ds=[]
            for (s,d),obj in sorted(districts.items()):
                if s!=statecode: continue
                rows=con.execute('SELECT * FROM places WHERE state=? AND district=? ORDER BY CAST(id AS INTEGER)',(s,d)).fetchall()
                places=[make_place(row) for row in rows]
                rel=f'states/{s}/districts/{d}.json'
                meta=write(stage,rel,{'schemaVersion':SCHEMA,'catalogueVersion':version,'country':'IN','stateCode':s,'districtCode':d,'places':places})
                entry={**meta,'code':d,'name':obj['name'],'geonameId':obj['id'],'count':len(places),'kind':'district'}
                ds.append(entry);pack_files.append(entry);indexed+=len(places)
            # A pair might reference a district code in another state: compare full pair.
            rows=con.execute('SELECT * FROM places WHERE state=? ORDER BY CAST(id AS INTEGER)',(statecode,))
            extra=[make_place(row) for row in rows if (row[6],row[7]) not in validdistricts]
            unresolved=None
            if extra:
                meta=write(stage,f'states/{statecode}/unmapped.json',{'schemaVersion':SCHEMA,'catalogueVersion':version,'country':'IN','stateCode':statecode,'districtCode':None,'places':extra,'label':'Unmapped places (district not confirmed)'})
                unresolved={**meta,'code':'unmapped','name':'Unmapped places (district not confirmed)','count':len(extra),'kind':'unmapped'}
                indexed+=len(extra);pack_files.append(unresolved)
            catalog_states.append({'code':statecode,'geonameId':state['id'],'name':state['name'],'districts':ds,'unmapped':unresolved})
        country_missing=[make_place(row) for row in con.execute('SELECT * FROM places ORDER BY CAST(id AS INTEGER)') if row[6] not in states]
        if country_missing:
            meta=write(stage,'country-unmapped.json',{'schemaVersion':SCHEMA,'catalogueVersion':version,'country':'IN','stateCode':None,'districtCode':None,'places':country_missing,'label':'Unresolved state records'})
            countrymeta={**meta,'code':'unresolved-state','name':'Unresolved state','count':len(country_missing),'kind':'unmapped'}
            pack_files.append(countrymeta);indexed+=len(country_missing)
        else:countrymeta=None
        if indexed!=raw['p_selected']: raise ValueError(f'Lost selected populated places: {indexed} != {raw["p_selected"]}')
        # Server authority index: 256 small JSON buckets addressed by numeric ID modulo 256.
        # Pack metadata remains mobile-only; private settings are never included.
        bucketfiles=[]
        for i in range(256):
            vals={}
            for row in con.execute('SELECT id,lat,lng,state,district,name FROM places WHERE bucket=? ORDER BY CAST(id AS INTEGER)',(i,)):
                id_,lat,lng,s,d,name=row
                vals[id_]=[lat,lng,s,d,name]
            meta=write(stage,f'server/{i:02x}.json',{'catalogueVersion':version,'places':vals})
            bucketfiles.append(meta)
        source_counts={'rows':raw['rows'],'pClass':raw['p_class'],'included':raw['p_selected'],'excludedP':raw['p_excluded'],
                       'adm1':len(states),'adm2':len(districts),'blankDistrictAllP':raw['p_missing_admin2_all'],
                       'includedBlankDistrict':raw['p_selected_missing_admin2'],'includedBlankState':raw['p_selected_missing_admin1']}
        manifest={'schemaVersion':SCHEMA,'catalogueVersion':version,'country':'IN','sourceSha256':source_hash,'sourceBytes':src_bytes,
                  'packFormat':'application/json','attribution':'GeoNames · CC BY 4.0','states':catalog_states,
                  'countryUnmapped':countrymeta,'totalPlaces':indexed,'serverIndex':bucketfiles}
        write(stage,'manifest.json',manifest)
        write(stage,'attribution.json',{**ATTRIBUTION,'sourceSha256':source_hash,'catalogueVersion':version})
        report={'sourceSha256':source_hash,'sourceBytes':src_bytes,'catalogueVersion':version,'sourceCounts':source_counts,
                'featureCounts':dict(sorted(codes.items())),'unresolvedSelected':dict(failures),
                'totalPublished':indexed,'districtPackCount':len(districts),
                'unmappedPackCount':sum(bool(x['unmapped']) for x in catalog_states)+(countrymeta is not None),
                'plainPackBytesTotal':sum(x['bytes'] for x in pack_files),
                'largestPacks':sorted(pack_files,key=lambda x:-x['bytes'])[:10],
                'notice':'GeoNames ADM codes are not LGD codes. Missing codes retained, never inferred. No national border geometry in this dataset.'}
        write(stage,'build-report.json',report)
        con.close();(stage/'scratch.sqlite').unlink()
        verify(stage)
        # Publish only when target absent. Existing version is immutable, no unsafe overwrite.
        if target.exists():
            raise FileExistsError(f'Target already exists; immutable version refused: {target}')
        stage.rename(target)
        print(json.dumps({'status':'PASS','version':version,'sourceSha256':source_hash,'sourceCounts':source_counts,
                          'published':indexed,'districts':len(districts),'sizeBytes':report['plainPackBytesTotal']},sort_keys=True))
    except Exception:
        con.close() if con else None
        shutil.rmtree(stage,ignore_errors=True)
        raise

def verify(root:Path):
    root=root.resolve();manifest=json.loads((root/'manifest.json').read_text('utf-8'))
    assert manifest['packFormat']=='application/json'
    packs=[]
    for st in manifest['states']:
        packs.extend(st['districts'])
        if st['unmapped']:packs.append(st['unmapped'])
    if manifest.get('countryUnmapped'):packs.append(manifest['countryUnmapped'])
    total=0;ids=set();expected={}
    for meta in packs:
        rel=meta['path'];parts=Path(rel).parts
        if rel.startswith('/') or '..' in parts or not rel.endswith('.json'):raise ValueError('unsafe pack path')
        payload=(root/rel).read_bytes()
        if sha(payload)!=meta['sha256'] or len(payload)!=meta['bytes']:raise ValueError('pack checksum/size mismatch '+rel)
        obj=json.loads(payload)
        if obj['schemaVersion']!=SCHEMA or obj['catalogueVersion']!=manifest['catalogueVersion']:raise ValueError('schema/version mismatch '+rel)
        if obj['country']!='IN' or len(obj['places'])!=meta['count']:raise ValueError('count/country mismatch '+rel)
        for place in obj['places']:
            id_=place['id']; lat=place['lat'];lng=place['lng']
            if id_ in ids:raise ValueError('duplicate id '+id_)
            ids.add(id_)
            expected[id_]=[lat,lng,place['name']]
            if not (-90<=lat<=90 and -180<=lng<=180):raise ValueError('invalid center '+id_)
            if not isinstance(place['aliases'],list):raise ValueError('invalid alias type')
        total+=len(obj['places'])
    if total!=manifest['totalPlaces']:raise ValueError('total does not reconcile')
    # Verify server canonical index is complete, unique, and consistent with published packs.
    seen=set()
    for i in range(256):
        meta=manifest['serverIndex'][i]
        index_bytes=(root/f'server/{i:02x}.json').read_bytes()
        if meta['sha256']!=sha(index_bytes) or meta['bytes']!=len(index_bytes):raise ValueError('invalid server shard checksum')
        index=json.loads(index_bytes)
        if index['catalogueVersion']!=manifest['catalogueVersion']:raise ValueError('bad index version')
        for id_,point in index['places'].items():
            if int(id_)%256!=i or id_ in seen:raise ValueError('bad server index key')
            if [point[0],point[1],point[4]]!=expected.get(id_):raise ValueError('canonical coordinates/name mismatch')
            seen.add(id_)
    if ids!=seen:raise ValueError('canonical lookup index mismatch')
    print(f'PASS: {len(packs)} plain JSON packs; {total} unique places; 256 verified canonical index shards')
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=('build','verify'));p.add_argument('--source',type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args()
    if a.action=='build':
        if not a.source:p.error('build requires --source')
        build(a.source,a.out)
    else:verify(a.out)
