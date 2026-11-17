import 'package:flutter/material.dart';
import 'discovery_location_gate.dart';

/// Third main tab: Local Feed and Activities are two subsections of this tab.
/// Neither exposes people, posts or activity discovery before later P03 phases.
/// Only the active subsection reads the signed-in owner's saved location.
class LocalFeedActivitiesSections extends StatefulWidget {
  const LocalFeedActivitiesSections({super.key, required this.baseUrl,
    required this.access, required this.active, required this.refreshEpoch,
    required this.onLocationSaved});

  final String baseUrl;
  final Future<String> Function() access;
  final bool active;
  final int refreshEpoch;
  final ValueChanged<String> onLocationSaved;

  @override
  State<LocalFeedActivitiesSections> createState() =>
    _LocalFeedActivitiesSectionsState();
}

class _LocalFeedActivitiesSectionsState extends State<LocalFeedActivitiesSections> {
  int selected = 0;
  static const modes = <String>['local-feed', 'activities'];

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      SegmentedButton<int>(
        key: const Key('p03-local-sections'),
        showSelectedIcon: false,
        segments: const [
          ButtonSegment(value: 0, label: Text('Local Feed')),
          ButtonSegment(value: 1, label: Text('Activities')),
        ],
        selected: <int>{selected},
        onSelectionChanged: (choice) => setState(() => selected = choice.first),
      ),
      const SizedBox(height: 16),
      KeyedSubtree(
        key: ValueKey<String>('p03-local-section-${modes[selected]}'),
        child: DiscoveryLocationGate(
          mode: modes[selected],
          baseUrl: widget.baseUrl,
          access: widget.access,
          active: widget.active,
          refreshEpoch: widget.refreshEpoch,
          onLocationSaved: widget.onLocationSaved,
        ),
      ),
    ],
  );
}
