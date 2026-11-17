#!/usr/bin/env python3
"""Offline verifier for U_luv ALL-JSON single S3 bucket release ZIP.

Does not contact AWS. Requires out-of-band canonical manifest SHA256,
not a value read from the same ZIP being verified.

python scripts/geo/verify_onebucket_release.py \
  --zip C:/Downloads/Uluv_India_Geo_All_JSON_S3_One_Bucket.zip \
  --expected-canonical-sha 8f4c54c2acbf474fba5ee07eefa86c4e86903299af04a0a9e57f0fa72c8f9caa
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

SHA=re.compile(r'^[a-f0-9]{64}$')

def digest(b):return hashlib.sha256(b).hexdigest()

def verify_zip(path:Path,expected_canonical:str)->dict:
    if not SHA.fullmatch(expected_canonical):raise ValueError('Expected canonical SHA256 must be supplied out-of-band')
    prefix='geo/india/v1/'
    with zipfile.ZipFile(path) as z:
        names=z.namelist()
        if z.testzip() is not None:raise ValueError('ZIP CRC failure')
        if len(names)!=1058 or len(names)!=len(set(names)) or not all(n.startswith(prefix) and n.endswith('.json') and '..' not in n.split('/') for n in names):
            raise ValueError('Unexpected or unsafe S3 ZIP object listing')
        def load(rel):
            name=prefix+rel
            if name not in names:raise ValueError('Missing object '+name)
            b=z.read(name)
            return b,json.loads(b)
        full_bytes,full=load('server-index-manifest.json')
        if digest(full_bytes)!=expected_canonical:raise ValueError('Untrusted canonical manifest SHA256')
        pub_bytes,pub=load('manifest.json')
        if {k:v for k,v in full.items() if k!='serverIndex'}!=pub or 'serverIndex' in pub:
            raise ValueError('Public manifest does not equal canonical projection')
        metas=[]
        for state in full['states']:
            metas.extend(state['districts'])
            if state['unmapped']:metas.append(state['unmapped'])
        if full['countryUnmapped']:metas.append(full['countryUnmapped'])
        if len(full['states'])!=36 or len(metas)!=798 or len(full['serverIndex'])!=256:
            raise ValueError('Incomplete geographic dataset')
        ids=set();place_total=0
        for meta in metas:
            raw,pack=load(meta['path'])
            if digest(raw)!=meta['sha256'] or len(raw)!=meta['bytes'] or len(pack['places'])!=meta['count']:
                raise ValueError('Location pack checksum/count mismatch: '+meta['path'])
            if pack['country']!='IN' or pack['catalogueVersion']!=full['catalogueVersion'] or pack['schemaVersion']!=1:
                raise ValueError('Location pack schema/version mismatch')
            for item in pack['places']:
                key=item['id']
                if key in ids:raise ValueError('Duplicate GeoNames id: '+str(key))
                ids.add(key)
            place_total+=len(pack['places'])
        shard_ids=set()
        for i,meta in enumerate(full['serverIndex']):
            if meta['path']!=f'server/{i:02x}.json':raise ValueError('Incorrect canonical shard path')
            raw,shard=load(meta['path'])
            if digest(raw)!=meta['sha256'] or len(raw)!=meta['bytes'] or shard['catalogueVersion']!=full['catalogueVersion']:
                raise ValueError('Canonical index checksum/version mismatch: '+meta['path'])
            for key in shard['places']:
                if int(key)%256!=i or key in shard_ids:raise ValueError('Invalid/duplicate canonical ID: '+key)
                shard_ids.add(key)
        if shard_ids!=ids or place_total!=full['totalPlaces']:
            raise ValueError('Index/location pack ID reconciliation failed')
        load('attribution.json');load('build-report.json')
        if (len(names)!=len(metas)+len(full['serverIndex'])+4):raise ValueError('Unknown extra files')
        return {'result':'PASS','objects':len(names),'locationPacks':len(metas),
                'serverShards':len(full['serverIndex']),'locations':place_total,
                'catalogueVersion':full['catalogueVersion'],
                'canonicalManifestSha256':digest(full_bytes),'publicManifestSha256':digest(pub_bytes),
                'zipSha256':digest(path.read_bytes())}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--zip',type=Path,required=True)
    p.add_argument('--expected-canonical-sha',required=True)
    args=p.parse_args()
    print(json.dumps(verify_zip(args.zip,args.expected_canonical_sha),indent=2))
if __name__=='__main__':main()
