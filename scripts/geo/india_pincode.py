#!/usr/bin/env python3
"""Build/verify offline India postal directory from an owner-supplied DoP CSV.

NO network. NO GeoNames country TXT -> PIN inference. Generated postal rows NEVER
contain phone numbers, people, coordinates or account locations.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

MAX_ROWS=500_000
MAX_SHARD=1_600_000
MAX_FILE_BYTES=50_000_000
SCHEMA=1
REQUIRED={'pin': ('pincode','pin','pincode_no','postalcode'),
          'office':('officename','office_name','postofficename','postoffice','office'),
          'district':('district','districtname','district_name'),
          'state':('state','statename','state_name')}
OPTIONAL={'officeType':('officetype','office_type'), 'delivery':('delivery','deliverystatus','delivery_status')}


def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest()

def normalized_key(s: str) -> str: return re.sub(r'[^a-z0-9]','',s.lower())

def cleaned(value: str, limit: int = 110) -> str:
    if not isinstance(value,str): raise ValueError('Non-text postal column')
    value=unicodedata.normalize('NFC', value).strip().replace(chr(160),' ')
    if not value or len(value)>limit or any(ord(c)<32 for c in value): raise ValueError('Invalid postal text')
    return ' '.join(value.split())

def jsonbytes(data: object) -> bytes:
    return (json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode('utf-8')

def checked_source(path: Path) -> bytes:
    n=path.stat().st_size
    if n<20 or n>MAX_FILE_BYTES: raise ValueError('Postal CSV byte limit exceeded or empty')
    return path.read_bytes()

def extract(source: Path):
    # CSV files may have BOM. Preserve PIN codes as strings with all six digits.
    raw=checked_source(source)
    digest=sha(raw)
    try: text=raw.decode('utf-8-sig',errors='strict')
    except UnicodeDecodeError as exc: raise ValueError('CSV must be UTF-8') from exc
    reader=csv.DictReader(text.splitlines())
    if not reader.fieldnames: raise ValueError('Missing CSV header')
    header={normalized_key(x):x for x in reader.fieldnames if x}
    mapping={}
    for target,alternatives in REQUIRED.items():
        found=[header[a] for a in alternatives if a in header]
        if len(found)!=1: raise ValueError('Missing/ambiguous required column: '+target)
        mapping[target]=found[0]
    for target,alternatives in OPTIONAL.items():
        found=[header[a] for a in alternatives if a in header]
        if len(found)>1: raise ValueError('Ambiguous optional column: '+target)
        mapping[target]=found[0] if found else None
    result=defaultdict(list)
    seen=set(); rows=0; dupes=0; invalid=[]
    for i,row in enumerate(reader,start=2):
        if i>MAX_ROWS+1:raise ValueError('Too many CSV rows')
        rows+=1
        if None in row: invalid.append({'line':i,'error':'extra_columns'});continue
        try:
            pin=cleaned(row[mapping['pin']] or '',12)
            if not re.fullmatch(r'[1-9][0-9]{5}',pin): raise ValueError('invalid_pincode')
            record={k:cleaned(row[column] or '',90 if k=='office' else 100)
                    for k,column in mapping.items() if k!='pin' and column and (row[column] or '').strip()}
            if not all(k in record for k in ('office','district','state')):raise ValueError('missing_place_fields')
            record.setdefault('officeType','')
            record.setdefault('delivery','')
            key=(pin,record['office'].casefold(),record['district'].casefold(),record['state'].casefold(),record['officeType'].casefold())
            if key in seen:dupes+=1;continue
            seen.add(key)
            result[pin].append(record)
        except (ValueError,KeyError) as exc:
            invalid.append({'line':i,'error':str(exc)[:80]})
            if len(invalid)>10000:raise ValueError('Excess invalid postal source rows')
    if invalid:raise ValueError(f'{len(invalid)} invalid rows; first={invalid[:5]} (nothing published)')
    if not result:raise ValueError('No valid PIN records')
    for records in result.values():records.sort(key=lambda x:(x['state'].casefold(),x['district'].casefold(),x['office'].casefold(),x['officeType'].casefold()))
    return result,{'sourceSha256':digest,'sourceBytes':len(raw),'inputRows':rows,'duplicateRows':dupes,'acceptedOfficeRows':sum(map(len,result.values())),'distinctPins':len(result)}


def build(source: Path,out: Path,source_url: str,asof: str) -> dict:
    if not source_url.startswith('https://') or len(source_url)>300:raise ValueError('Require documented HTTPS provenance source URL')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',asof):raise ValueError('Require source snapshot date YYYY-MM-DD')
    records,stats=extract(source)
    version='PIN-'+stats['sourceSha256'][:16]
    if out.exists():raise ValueError('Target exists; keep old release and choose new path')
    out.parent.mkdir(parents=True,exist_ok=True)
    scratch=Path(tempfile.mkdtemp(prefix='.pincode-build-',dir=out.parent))
    try:
        prefixes=[]
        for prefix in sorted({pin[:3] for pin in records}):
            contents={pin:records[pin] for pin in sorted(records) if pin.startswith(prefix)}
            blob=jsonbytes({'schemaVersion':SCHEMA,'version':version,'prefix':prefix,'pincodes':contents})
            if len(blob)>MAX_SHARD:raise ValueError('Prefix JSON exceeds safe size: '+prefix)
            relative='prefixes/'+prefix+'.json'
            file=scratch/relative;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(blob)
            prefixes.append({'prefix':prefix,'path':relative,'sha256':sha(blob),'bytes':len(blob),'pinCount':len(contents),'officeCount':sum(map(len,contents.values()))})
        manifest={'schemaVersion':SCHEMA,'version':version,'country':'IN','sourceName':'Department of Posts — All India PIN Code Directory',
                  'sourceUrl':source_url,'sourceDate':asof,'sourceSha256':stats['sourceSha256'],
                  'prefixes':prefixes,'counts':stats,'licence':'Government Open Data License - India',
                  'lookupIsGeolocation':False}
        (scratch/'manifest.json').write_bytes(jsonbytes(manifest))
        (scratch/'attribution.json').write_bytes(jsonbytes({'attribution':'Ministry of Communications, Department of Posts, Government of India; via data.gov.in',
            'licence':'Government Open Data License - India','sourceUrl':source_url,'sourceDate':asof,
            'transformation':'Removed unused columns; normalized office/district/state labels; deduplicated source postal office rows; no coordinates inferred.'}))
        verify(scratch)
        scratch.rename(out) # Publish only fully verified directory. Old versions never touched.
        return manifest
    except Exception:
        shutil.rmtree(scratch,ignore_errors=True)
        raise


def verify(directory: Path) -> dict:
    manifest=json.loads((directory/'manifest.json').read_text('utf-8'))
    if manifest.get('schemaVersion')!=1 or manifest.get('country')!='IN' or not re.fullmatch(r'PIN-[a-f0-9]{16}',manifest.get('version','')):raise ValueError('Bad manifest')
    prefixes=manifest.get('prefixes',[])
    if not isinstance(prefixes,list) or len(prefixes)!=len(set(x['prefix'] for x in prefixes)):raise ValueError('Bad prefix manifest')
    total=0;distinct=0
    for meta in prefixes:
        prefix=meta['prefix']
        if not re.fullmatch(r'[1-9][0-9]{2}',prefix) or meta['path']!='prefixes/'+prefix+'.json':raise ValueError('Unsafe prefix path')
        blob=(directory/meta['path']).read_bytes()
        if len(blob)!=meta['bytes'] or sha(blob)!=meta['sha256']:raise ValueError('PIN pack hash mismatch: '+prefix)
        pack=json.loads(blob)
        if pack.get('schemaVersion')!=1 or pack.get('prefix')!=prefix or pack.get('version')!=manifest['version']:raise ValueError('PIN pack mismatch')
        pins=pack['pincodes']
        if len(pins)!=meta['pinCount']:raise ValueError('PIN count mismatch')
        count=0
        for pin,rows in pins.items():
            if not re.fullmatch(prefix+r'[0-9]{3}',pin) or not isinstance(rows,list) or not rows:raise ValueError('Invalid PIN pack')
            for row in rows:
                if not isinstance(row,dict) or not all(isinstance(row.get(k),str) for k in ('office','state','district','officeType','delivery')):raise ValueError('Invalid postal record')
            count+=len(rows)
        if count!=meta['officeCount']:raise ValueError('Office count mismatch')
        distinct+=len(pins);total+=count
    if distinct!=manifest['counts']['distinctPins'] or total!=manifest['counts']['acceptedOfficeRows']:raise ValueError('Global PIN reconciliation failed')
    if any(f.suffix!='.json' for f in directory.rglob('*') if f.is_file()):raise ValueError('Non-JSON asset')
    return {'version':manifest['version'],'distinctPins':distinct,'offices':total,'prefixPacks':len(prefixes)}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['build','verify']);p.add_argument('--source',type=Path);p.add_argument('--out',type=Path,required=True,help='External data directory; do not generate into the code repository')
    p.add_argument('--source-url',default='https://data.gov.in/resource/all-india-pincode-directory-till-last-month')
    p.add_argument('--source-date')
    args=p.parse_args()
    if args.action=='build':
        if args.source is None or args.source_date is None:p.error('build requires --source and --source-date')
        result=build(args.source,args.out,args.source_url,args.source_date)
        print(json.dumps({'status':'BUILT','version':result['version'],**result['counts'],'prefixPacks':len(result['prefixes'])}))
    else:print(json.dumps({'status':'VERIFIED',**verify(args.out)}))
if __name__=='__main__':main()
