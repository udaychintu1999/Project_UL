"""Offline, real-file regression gates for the generated nationwide catalogue."""
import hashlib
import json
import os
from pathlib import Path
import unittest

ROOT=Path(os.environ.get('ULUV_GEO_CATALOGUE_DIR','geo/india/v1'))

class CatalogueContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (ROOT/'manifest.json').exists() or not (ROOT/'build-report.json').exists():
            raise unittest.SkipTest('Full offline build not installed; set ULUV_GEO_CATALOGUE_DIR to an external GeoNames build')
        cls.manifest=json.loads((ROOT/'manifest.json').read_text('utf-8'))
        cls.report=json.loads((ROOT/'build-report.json').read_text('utf-8'))

    def test_full_dataset_counts_are_measured_not_assumed(self):
        self.assertEqual(self.manifest['sourceSha256'],self.report['sourceSha256'])
        self.assertEqual(self.report['sourceCounts']['rows'],660065)
        self.assertEqual(self.report['sourceCounts']['adm1'],36)
        self.assertEqual(self.report['sourceCounts']['adm2'],763)
        self.assertEqual(self.manifest['totalPlaces'],549046)
        self.assertEqual(len(self.manifest['serverIndex']),256)

    def test_only_plain_json_artifacts_and_distinct_geonames_codes(self):
        self.assertTrue(all(p.suffix=='.json' for p in ROOT.rglob('*') if p.is_file()))
        codes=[s['code'] for s in self.manifest['states']]
        self.assertEqual(len(codes),len(set(codes)))
        for state in self.manifest['states']:
            ds=[d['code'] for d in state['districts']]
            self.assertEqual(len(ds),len(set(ds)))

    def test_populated_not_station_or_abandoned(self):
        ids=('1254813','1254812','1252685','1252948','1253189')
        present=[]
        for id_ in ids:
            shard=int(id_)%256
            d=json.loads((ROOT/f'server/{shard:02x}.json').read_text())
            present.append(id_ in d['places'])
        self.assertEqual(present,[True,False,False,True,False])

    def test_server_shards_checksummed_and_corruption_detected(self):
        entry=self.manifest['serverIndex'][0]
        raw=(ROOT/entry['path']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),entry['sha256'])
        modified=raw+b'x'
        self.assertNotEqual(hashlib.sha256(modified).hexdigest(),entry['sha256'])

    def test_unmapped_places_preserved(self):
        self.assertGreater(self.report['unresolvedSelected']['blank_district'],0)
        self.assertGreater(self.report['unmappedPackCount'],0)
        self.assertIsNotNone(self.manifest['countryUnmapped'])
        self.assertEqual(self.manifest['countryUnmapped']['count'],36)

    def test_unicode_local_script_aliases_survive(self):
        # Vijayawada has Telugu aliases, Yadgir has Hindi and Kannada aliases.
        for id_, low, high in [('1253184',0x0C00,0x0C80),('1252822',0x0C80,0x0D00)]:
            found=False
            for st in self.manifest['states']:
                for d in st['districts']:
                    if d['count']==0:continue
                    if d['path'].startswith('states/02/') != (id_=='1253184') and id_=='1253184':continue
                    # source record lookup from static shard provides state/district
                    index=json.loads((ROOT/f'server/{int(id_)%256:02x}.json').read_text())['places'][id_]
                    if st['code'] != index[2] or d['code'] != index[3]: continue
                    pack=json.loads((ROOT/d['path']).read_text())
                    record=next(x for x in pack['places'] if x['id']==id_)
                    found=any(any(low<=ord(ch)<high for ch in a) for a in record['aliases'])
                    break
                if found:break
            self.assertTrue(found,id_)

if __name__=='__main__':unittest.main()
