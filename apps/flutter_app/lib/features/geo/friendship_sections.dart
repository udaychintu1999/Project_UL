import 'package:flutter/material.dart';
import 'discovery_location_gate.dart';

/// Friendship is its own main tab. Local Feed and Activities live in the
/// separate third tab, not inside Friendship. Discovery remains disabled.
class FriendshipSections extends StatelessWidget {
  const FriendshipSections({super.key, required this.baseUrl,
    required this.access, required this.active, required this.refreshEpoch,
    required this.onLocationSaved});

  final String baseUrl;
  final Future<String> Function() access;
  final bool active;
  final int refreshEpoch;
  final ValueChanged<String> onLocationSaved;

  @override
  Widget build(BuildContext context) => DiscoveryLocationGate(
    key: const Key('p03-friendship-people-only'),
    mode: 'friendship',
    baseUrl: baseUrl,
    access: access,
    active: active,
    refreshEpoch: refreshEpoch,
    onLocationSaved: onLocationSaved,
  );
}
