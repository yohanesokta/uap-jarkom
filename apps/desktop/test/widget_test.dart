import 'package:flutter_test/flutter_test.dart';
import 'package:desktop/main.dart';

void main() {
  testWidgets('PacketTracerExamApp initial render test', (WidgetTester tester) async {
    await tester.pumpWidget(const PacketTracerExamApp());
    expect(find.text('UJIAN AKHIR PRAKTIKUM JARINGAN KOMPUTER'), findsOneWidget);
    expect(find.text('Validasi & Mulai Ujian'), findsOneWidget);
  });
}
