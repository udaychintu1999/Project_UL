import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main(){
 testWidgets('Settings expansion and keyed input have distinct storage paths',(tester) async {
   await tester.pumpWidget(const MaterialApp(home:Scaffold(body:CustomScrollView(
     key:PageStorageKey<String>('p02-scroll-Account & safety'),
     slivers:[SliverToBoxAdapter(child:ExpansionTile(
       key:PageStorageKey<String>('p03-location-expansion'),
       title:Text('Location and Discovery'),
       children:[KeyedSubtree(
         key:PageStorageKey<String>('p03-1c-pin-scroll-scope'),
         child:TextField(key:Key('p03-1c-pin-input')),
       )],
     ))],
   ))));
   await tester.tap(find.text('Location and Discovery'));
   await tester.pumpAndSettle();
   await tester.enterText(find.byKey(const Key('p03-1c-pin-input')),'500001');
   await tester.tap(find.text('Location and Discovery'));
   await tester.pumpAndSettle();
   await tester.tap(find.text('Location and Discovery'));
   await tester.pumpAndSettle();
   expect(tester.takeException(),isNull);
   expect(find.byKey(const Key('p03-1c-pin-input')),findsOneWidget);
 });
}
