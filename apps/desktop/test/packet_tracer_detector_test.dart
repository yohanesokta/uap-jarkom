import 'package:flutter_test/flutter_test.dart';
import 'package:desktop/core/process/packet_tracer_detector.dart';

void main() {
  group('PacketTracerDetector Unit Tests', () {
    test('should run detect without throwing exceptions', () async {
      final detector = PacketTracerDetector();
      final result = await detector.detect();
      expect(result.isInstalled, true);
      expect(result.executablePath, contains('packettracer'));
    });
  });
}
