#!/usr/bin/env python3
"""Export one complete, verified GeoNames JSON tree for the SAME S3 bucket.

No network, AWS SDK, AWS CLI, secrets or private user records.
Original full manifest remains the importer source in --source-dir; S3 gets a
sanitized Flutter manifest.json and its full canonical companion at
server-index-manifest.json. Fastify pins the SHA256 of that companion outside S3.

Example:
  python scripts/geo/export_s3_bundle.py --source-dir C:/geo-build/india/v1 \
      --output-dir C:/geo-release
Then extract the resulting ZIP and upload the *geo* FOLDER through AWS Console.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from india_catalogue import verify as verify_catalogue


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(data: object) -> bytes:
    return (json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode('utf-8')


def add(z:zipfile.ZipFile,path:str,data:bytes):
    entry=zipfile.ZipInfo(path,date_time=(1980,1,1,0,0,0))
    entry.compress_type=zipfile.ZIP_DEFLATED
    entry.external_attr=0o644<<16
    z.writestr(entry,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=8)


def export(source_dir:Path,output_dir:Path,public_prefix:str='geo/india/v1')->dict:
    if not re.fullmatch(r'geo/india/v[1-9][0-9]*',public_prefix):
        raise ValueError('Invalid immutable public prefix')
    source_dir=source_dir.resolve();output_dir=output_dir.resolve()
    if not source_dir.is_dir():raise ValueError('No source catalogue directory')
    if source_dir==output_dir or source_dir in output_dir.parents or output_dir in source_dir.parents:
        raise ValueError('Export to an independent directory')
    full=verify_catalogue(source_dir) # all 798 packs and 256 shards, source provenance
    if not re.fullmatch('IN-[a-f0-9]{16}',full['catalogueVersion']):
        raise ValueError('Invalid catalogue version')
    canonical_bytes=(source_dir/'manifest.json').read_bytes()
    public={k:v for k,v in full.items() if k!='serverIndex'}
    pub_bytes=json_bytes(public)
    paths={
        'manifest.json':pub_bytes,
        'server-index-manifest.json':canonical_bytes,
        'attribution.json':(source_dir/'attribution.json').read_bytes(),
        'build-report.json':(source_dir/'build-report.json').read_bytes(),
    }
    metas=[]
    for state in full['states']:
        metas.extend(state['districts'])
        if state.get('unmapped'):metas.append(state['unmapped'])
    if full.get('countryUnmapped'):metas.append(full['countryUnmapped'])
    if len(metas)!=798 or len(full['serverIndex'])!=256:
        raise ValueError('Incomplete GeoNames publication')
    for meta in metas+full['serverIndex']:
        path=meta['path']
        if not re.fullmatch(r'(?:states/[0-9]{1,4}/districts/[0-9]{1,6}\.json|states/[0-9]{1,4}/unmapped\.json|country-unmapped\.json|server/[0-9a-f]{2}\.json)',path):
            raise ValueError('Unsafe GeoNames path: '+path)
        if path in paths:raise ValueError('Duplicate GeoNames path: '+path)
        b=(source_dir/path).read_bytes()
        if len(b)!=meta['bytes'] or sha(b)!=meta['sha256']:
            raise ValueError('GeoNames pack checksum mismatch: '+path)
        paths[path]=b
    assert len(paths)==1058
    for path,data in paths.items():
        json.loads(data)
    output_dir.mkdir(parents=True,exist_ok=True)
    output=output_dir/'Uluv_India_Geo_All_JSON_S3_One_Bucket.zip'
    if output.exists():raise FileExistsError('Immutable release ZIP already exists: '+str(output))
    try:
        with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=8) as z:
            for path in sorted(paths):add(z,public_prefix+'/'+path,paths[path])
        with zipfile.ZipFile(output) as z:
            if z.testzip() is not None or len(z.namelist())!=1058:
                raise ValueError('GeoNames output ZIP validation failed')
            for path,data in paths.items():
                if z.read(public_prefix+'/'+path)!=data:
                    raise ValueError('GeoNames output bytes mismatch: '+path)
        return {'version':full['catalogueVersion'],'objects':len(paths),
                'locationPacks':len(metas),'serverShards':len(full['serverIndex']),
                'publicManifestSha256':sha(pub_bytes),'canonicalManifestSha256':sha(canonical_bytes),
                'zipSha256':sha(output.read_bytes()),'zip':str(output)}
    except Exception:
        output.unlink(missing_ok=True)
        raise


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-dir',type=Path,required=True)
    p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--public-prefix',default='geo/india/v1',help='Immutable S3 key prefix, e.g. geo/india/v2')
    args=p.parse_args()
    print(json.dumps(export(args.source_dir,args.output_dir,args.public_prefix),indent=2))

if __name__=='__main__':main()
