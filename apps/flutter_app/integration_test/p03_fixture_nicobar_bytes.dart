// Device-only P03 fixture: original 5908-byte checked-in Nicobar JSON pack.
// GZIP/base64 is embedded because integration_test Dart files are compiled
// onto Android while files under test/fixtures/ are not Flutter assets.
// The production GeoNames manifest validates the SHA-256 before activation.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

Uint8List p03DeviceNicobarPack() => Uint8List.fromList(
    gzip.decode(base64Decode(_gzFixture)));

const _gzFixture =
    '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'
    'HK9q2M2e3mLDtPr5u/8AgE9TkhQXAAA='
;
