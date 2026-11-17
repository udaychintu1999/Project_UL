import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';

/// Checksum, parser and same-filesystem atomic activation are ALL required.
/// A newer pack never deletes a valid older version, even on failure.
Future<void> atomicActivateGeoPack({
  required File destination,
  required Uint8List plainJson,
  required Map<String,dynamic> manifestPack,
  required FutureOr<void> Function(Uint8List bytes) validateJson,
  bool Function()? isCancelled,
  Future<void> Function()? beforeCommitForTesting,
}) async {
  final expectedBytes=manifestPack['bytes'], expectedSha=manifestPack['sha256'];
  if(expectedBytes is! int || expectedSha is! String ||
      plainJson.length!=expectedBytes || sha256.convert(plainJson).toString()!=expectedSha) {
    throw const FormatException('GeoNames pack checksum/size mismatch');
  }
  await validateJson(plainJson);
  if(isCancelled?.call()==true)throw const FormatException('Cancelled before activation');
  final temp=File('${destination.path}.pending-${DateTime.now().microsecondsSinceEpoch}');
  try {
    await temp.writeAsBytes(plainJson,flush:true);
    final staged=await temp.readAsBytes();
    if(staged.length!=expectedBytes || sha256.convert(staged).toString()!=expectedSha) {
      throw const FormatException('Staged GeoNames file failed checksum');
    }
    await beforeCommitForTesting?.call();
    if(isCancelled?.call()==true)throw const FormatException('Cancelled before activation');
    await temp.rename(destination.path);
  } finally {
    if(await temp.exists())await temp.delete();
  }
}
