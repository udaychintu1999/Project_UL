import csv
import json
import tempfile
import unittest
from pathlib import Path
from india_pincode import build, verify, sha

class PincodeBuilderTests(unittest.TestCase):
    def make_csv(self, root):
        path=root/'post.csv'
        with path.open('w',encoding='utf-8',newline='') as f:
            w=csv.writer(f)
            w.writerow(['CircleName','Office Name','PIN Code','District Name','State Name','OfficeType','DeliveryStatus','latitude','longitude'])
            w.writerow(['Telangana','Hyderabad H.O','500001','Hyderabad','TELANGANA','H.O','Delivery','17.1','78.1'])
            w.writerow(['Telangana','Koti S.O','500001','Hyderabad','TELANGANA','S.O','Delivery','17.2','78.2'])
            w.writerow(['Telangana','Hyderabad H.O','500001','Hyderabad','TELANGANA','H.O','Delivery','17.1','78.1']) # duplicate
            w.writerow(['Telangana','కూకట్‌పల్లి B.O','500072','Hyderabad','TELANGANA','B.O','Delivery','17.3','78.3'])
            w.writerow(['Tamil Nadu','Chennai GPO','600001','Chennai','TAMIL NADU','G.P.O','Delivery','13.0','80.0'])
        return path
    def test_verifies_multiple_offices_unicode_and_dedupes_without_coords(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); source=self.make_csv(root); target=root/'v1'
            doc=build(source,target,'https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
            self.assertEqual(doc['counts']['inputRows'],5)
            self.assertEqual(doc['counts']['duplicateRows'],1)
            self.assertEqual(doc['counts']['distinctPins'],3)
            self.assertEqual(verify(target)['offices'],4)
            prefix=json.loads((target/'prefixes/500.json').read_text('utf8'))
            self.assertEqual(len(prefix['pincodes']['500001']),2)
            self.assertIn('కూకట్',prefix['pincodes']['500072'][0]['office'])
            self.assertNotIn('lat',(target/'prefixes/500.json').read_text('utf8'))
            self.assertNotIn('longitude',(target/'prefixes/500.json').read_text('utf8'))
            self.assertFalse(doc['lookupIsGeolocation'])
    def test_deterministic_and_no_partial_publish(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); src=self.make_csv(root)
            a=root/'v1';b=root/'v2'
            build(src,a,'https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
            build(src,b,'https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
            self.assertEqual({p.relative_to(a).as_posix():sha(p.read_bytes()) for p in a.rglob('*.json')},
                             {p.relative_to(b).as_posix():sha(p.read_bytes()) for p in b.rglob('*.json')})
            with self.assertRaises(ValueError):build(src,a,'https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
    def test_rejects_bad_pin_and_does_not_publish(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);source=self.make_csv(root)
            text=source.read_text('utf8').replace('500001','000001')
            source.write_text(text,encoding='utf8')
            with self.assertRaises(ValueError):build(source,root/'new','https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
            self.assertFalse((root/'new').exists())
    def test_changed_bytes_rejected_before_cache_activation(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);src=self.make_csv(root);out=root/'v1'
            build(src,out,'https://data.gov.in/resource/all-india-pincode-directory-till-last-month','2026-08-10')
            f=out/'prefixes/500.json';f.write_bytes(f.read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError,'hash mismatch'):verify(out)

if __name__=='__main__':unittest.main()
