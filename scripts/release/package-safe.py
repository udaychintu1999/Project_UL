#!/usr/bin/env python3
"""Safe, offline ZIP packer. Never reads .env, key material, external AWS profiles, media or local DB.

Usage:
  python scripts/release/package-safe.py --mode full --output ../U_luv_Full_Developer_Handoff_FINAL_v2_0.zip
  python scripts/release/package-safe.py --mode update --changed apps/api/src/app.ts scripts/verify/foo.mjs --output ../U_luv_P00_Update.zip
Run npm run test:secrets and npm run test:cloud-guards beforehand. Agent may package source but no secrets.
"""
import argparse,re,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SKIP_DIRS={'.git','.local','node_modules','.dart_tool','build','dist','coverage','releases','artifacts','__pycache__','.idea','.gradle','.venv','.pytest_cache'}
SKIP_SUFFIX={'.zip','.jar','.jpg','.jpeg','.webp','.png','.gif','.pdf','.docx','.pptx','.xlsx','.sqlite','.db','.so','.dll','.exe','.class','.pyc','.pem','.p8','.p12','.pfx','.jks','.keystore','.kdbx','.key','.der'}
FILE_BLACKLIST={'google-services.json','GoogleService-Info.plist','key.properties','credentials','config.credentials'}
TEXT_RULES=[('AWS_ACCESS_ID',re.compile(rb'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b')),('PRIVATE_KEY',re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----')),('SIGNED_URL',re.compile(rb'(?:X-Amz-Signature=[0-9a-fA-F]{48,}|[?&]Signature=[A-Za-z0-9%_\-]{48,})')),('PAYMENT_TOKEN',re.compile(rb'\b(?:sk_live_|rk_live_|ghp_|github_pat_)[A-Za-z0-9_\-]{16,}'))]

def allowed(p):
    if p.is_symlink():return False
    try:r=p.relative_to(ROOT)
    except ValueError:return False
    if any(x in SKIP_DIRS for x in r.parts[:-1]):return False
    name=p.name
    if name.startswith('.env') and not name.endswith('.example'):return False
    if name in FILE_BLACKLIST or name.lower() in {x.lower() for x in FILE_BLACKLIST}:return False
    if name.lower().endswith('.env') and name!='.env.example':return False
    if p.suffix.lower() in SKIP_SUFFIX:return False
    if name.endswith(('.log','.db-journal','.db-wal','.db-shm')):return False
    return p.is_file()

def main():
    parser=argparse.ArgumentParser(description='Offline fail-closed source/docs ZIP packager; no secrets or media')
    parser.add_argument('--mode',required=True,choices=['full','update'])
    parser.add_argument('--output',required=True)
    parser.add_argument('--changed',nargs='*',default=[])
    a=parser.parse_args()
    out=Path(a.output).expanduser().resolve()
    if out.exists():sys.exit('BLOCKED: output ZIP already exists; refusing overwrite')
    if a.mode=='update':
        if not a.changed:sys.exit('BLOCKED: update mode requires explicit --changed project-relative paths')
        candidates=set()
        for x in a.changed:
            p=(ROOT/x).resolve()
            if not p.is_relative_to(ROOT) or not allowed(p):sys.exit('BLOCKED: requested update path is missing, unsafe or not packageable')
            candidates.add(p)
        candidates.update(p for p in (ROOT/'docs').rglob('*') if allowed(p))
    else:
        roots=[ROOT/'AGENTS.md',ROOT/'README.md',ROOT/'package.json',ROOT/'.gitignore',ROOT/'.editorconfig',ROOT/'apps',ROOT/'docs',ROOT/'infra',ROOT/'scripts']
        candidates=set()
        for x in roots:
            if x.is_file() and allowed(x):candidates.add(x)
            elif x.is_dir():candidates.update(p for p in x.rglob('*') if allowed(p))
    if not candidates or not any(p.is_relative_to(ROOT/'docs') for p in candidates):sys.exit('BLOCKED: missing docs/ or no content')
    if any(p.stat().st_size>5_000_000 for p in candidates):sys.exit('BLOCKED: unexpectedly large file in source/docs ZIP')
    # Never print any content or inspect secret-bearing paths. Validate selected source/doc text only.
    for p in sorted(candidates):
        data=p.read_bytes()
        for rule,regex in TEXT_RULES:
            if regex.search(data):sys.exit('BLOCKED: '+rule+' detected in selected source/docs at '+str(p.relative_to(ROOT)))
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(candidates):z.write(p,p.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
        assert all(not Path(n).is_absolute() and '..' not in Path(n).parts and not n.startswith('/') for n in z.namelist())
        assert all(not any(s in n.lower() for s in ['.env.local','.env.production','/.aws/','google-services.json','googleService-info.plist'.lower()]) for n in z.namelist())
    print(f'PASS: created safe offline {a.mode} ZIP with {len(candidates)} source/docs files; no secret paths or patterns included. Output: {out}')
if __name__=='__main__':main()
